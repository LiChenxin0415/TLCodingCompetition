/**
 * LLM 客户端（OpenAI 兼容协议）
 * 需求依据：backend-design §7 —— 20s 超时、失败可重试、备用端点 fallback、解析失败视同失败
 *
 * 说明：仅依赖 Node 内置 fetch，不引入 SDK，便于现场快速切换模型/网关。
 */

import { config } from '../config.ts';
import type { LlmEndpoint } from '../config.ts';
import type { ChatMessage } from './prompt.ts';

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
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

async function callOnce(endpoint: LlmEndpoint, messages: ChatMessage[], timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (endpoint.apiKey !== '') headers.Authorization = `Bearer ${endpoint.apiKey}`;

  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages,
    temperature: config.llm.temperature,
  };
  if (config.llm.jsonMode) body.response_format = { type: 'json_object' };

  try {
    const res = await fetch(chatCompletionsUrl(endpoint.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new LlmError('http', `LLM 返回 HTTP ${res.status}`);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new LlmError('empty', 'LLM 返回内容为空');
    }
    return content;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    const e = err as Error;
    if (e.name === 'AbortError') {
      throw new LlmError('timeout', 'AI 调用超时');
    }
    throw new LlmError('network', e.message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 调用 LLM：按配置顺序尝试主端点与备用端点，总预算不超过 config.llm.timeoutMs（默认 20s，GEN-04）
 */
export async function callLlm(messages: ChatMessage[]): Promise<string> {
  const endpoints = config.llm.endpoints;
  if (endpoints.length === 0) {
    throw new LlmError('misconfigured', '未配置 LLM_BASE_URL');
  }

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

/** 去掉 markdown 代码围栏，截取首个 JSON 对象 */
export function extractJsonObject(content: string): unknown {
  let text = content.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence !== null) {
    text = fence[1].trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new LlmError('parse', 'AI 返回内容不是合法 JSON');
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new LlmError('parse', 'AI 返回内容解析失败');
  }
}
