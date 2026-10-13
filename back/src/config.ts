/**
 * 运行配置（.env + 进程环境变量）
 * 需求依据：第十章（配置项：端口、JWT 密钥、LLM Key/BaseURL、AI_ENABLED）
 * 说明：环境变量由 `node --env-file-if-exists=.env` 载入，见 package.json scripts
 */

export interface LlmEndpoint {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const timeoutMs = num(process.env.LLM_TIMEOUT_MS, 20_000); // GEN-04：超时上限 20 秒

/** 主端点（LLM_*），可选备用端点（LLM_BACKUP_*）：第十四章风险应对 */
const endpoints: LlmEndpoint[] = [];
const primary: LlmEndpoint = {
  baseUrl: (process.env.LLM_BASE_URL ?? '').trim(),
  apiKey: (process.env.LLM_API_KEY ?? '').trim(),
  model: (process.env.LLM_MODEL ?? 'gpt-4o-mini').trim(),
};
if (primary.baseUrl !== '') endpoints.push(primary);

const backup: LlmEndpoint = {
  baseUrl: (process.env.LLM_BACKUP_BASE_URL ?? '').trim(),
  apiKey: (process.env.LLM_BACKUP_API_KEY ?? '').trim(),
  model: (process.env.LLM_BACKUP_MODEL ?? primary.model).trim(),
};
if (backup.baseUrl !== '') endpoints.push(backup);

export const config = {
  port: num(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'tl-weekly-report-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h', // AUTH-03：有效期 24h
  dbFile: process.env.DB_FILE ?? 'data/weekly-report.db',
  /** AI_ENABLED=false 时进入降级模式（GEN-07）：不调 LLM，业务接口零影响 */
  aiEnabled: bool(process.env.AI_ENABLED, true),
  llm: {
    endpoints,
    timeoutMs,
    /** 部分 OpenAI 兼容网关支持 response_format=json_object，默认不发送以保证兼容 */
    jsonMode: bool(process.env.LLM_JSON_MODE, false),
    temperature: Number(process.env.LLM_TEMPERATURE ?? 0.3),
  },
  /** 允许跨域来源（前端 Vite 默认 5173） */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};

export function aiConfigured(): boolean {
  return config.llm.endpoints.length > 0;
}

/** AI 是否真正可用：开关打开且配置了端点 */
export function aiUsable(): boolean {
  return config.aiEnabled && aiConfigured();
}
