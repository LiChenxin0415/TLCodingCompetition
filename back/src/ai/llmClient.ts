import { config } from '../config.ts';
import type { LlmEndpoint } from '../config.ts';
import type { ChatMessage } from './prompts.ts';

export type LlmFailureKind = 'timeout' | 'network' | 'http' | 'empty' | 'parse' | 'misconfigured';

export class LlmError extends Error {
  kind: LlmFailureKind;
  constructor(kind: LlmFailureKind, message: string) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
  }
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/chat/completions') ? trimmed : trimmed + '/chat/completions';
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }>;
}

async function callOnce(endpoint: LlmEndpoint, messages: ChatMessage[], timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (endpoint.apiKey !== '') headers.Authorization = 'Bearer ' + endpoint.apiKey;

  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages,
    temperature: config.llm.temperature,
    max_tokens: config.llm.maxTokens,
    stream: false,
  };
  if (config.llm.jsonMode) body.response_format = { type: 'json_object' };

  try {
    const res = await fetch(chatCompletionsUrl(endpoint.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new LlmError('http', 'LLM 返回 HTTP ' + res.status);

    const json = (await res.json()) as ChatResponse;
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      // 推理型模型：若 content 为空但 reasoning_content 有内容，说明输出预算被推理耗尽
      const reasoning = json.choices?.[0]?.message?.reasoning_content;
      throw new LlmError('empty', typeof reasoning === 'string' && reasoning.trim() !== '' ? '推理型模型未产出最终答案（max_tokens 不足）' : 'LLM 返回内容为空');
    }
    return content;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    const e = err as Error;
    if (e.name === 'AbortError') throw new LlmError('timeout', 'AI 调用超时');
    throw new LlmError('network', e.message);
  } finally {
    clearTimeout(timer);
  }
}

export async function callLlm(messages: ChatMessage[]): Promise<string> {
  const endpoints = config.llm.endpoints;
  if (endpoints.length === 0) throw new LlmError('misconfigured', '未配置 LLM_BASE_URL');

  const startedAt = Date.now();
  let lastError: LlmError | null = null;
  for (const endpoint of endpoints) {
    const remaining = config.llm.timeoutMs - (Date.now() - startedAt);
    if (remaining <= 500) {
      lastError = lastError ?? new LlmError('timeout', 'AI 调用超时');
      break;
    }
    try {
      return await callOnce(endpoint, messages, remaining);
    } catch (err) {
      lastError = err instanceof LlmError ? err : new LlmError('network', (err as Error).message);
    }
  }
  throw lastError ?? new LlmError('network', 'AI 调用失败');
}

export function extractJsonObject(content: string): unknown {
  let text = content.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence !== null) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new LlmError('parse', 'AI 返回内容不是合法 JSON');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new LlmError('parse', 'AI 返回内容解析失败');
  }
}