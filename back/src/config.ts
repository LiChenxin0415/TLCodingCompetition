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

const timeoutMs = num(process.env.LLM_TIMEOUT_MS, 20000);

const endpoints: LlmEndpoint[] = [];
const primary: LlmEndpoint = {
  baseUrl: (process.env.LLM_BASE_URL ?? '').trim(),
  apiKey: (process.env.LLM_API_KEY ?? '').trim(),
  model: (process.env.LLM_MODEL ?? 'deepseek-v4-flash').trim(),
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
  jwtSecret: process.env.JWT_SECRET ?? 'tl-goal-contract-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  dbFile: process.env.DB_FILE ?? 'data/goal-contract.db',
  uploadsDir: process.env.UPLOADS_DIR ?? 'data/uploads',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  aiEnabled: bool(process.env.AI_ENABLED, true),
  llm: {
    endpoints,
    timeoutMs,
    maxTokens: num(process.env.LLM_MAX_TOKENS, 4096),
    temperature: Number(process.env.LLM_TEMPERATURE ?? 0.3),
    jsonMode: bool(process.env.LLM_JSON_MODE, false),
  },
};

export function aiConfigured(): boolean {
  return config.llm.endpoints.length > 0;
}

export function aiUsable(): boolean {
  return config.aiEnabled && aiConfigured();
}