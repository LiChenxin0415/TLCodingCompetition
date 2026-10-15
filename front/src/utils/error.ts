import type { ApiErrorBody } from '@/types';

/** 统一错误（HLD §7 错误码），由 http 拦截器转换后抛出 */
export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const DEFAULT_MSG: Record<number, string> = {
  400: '参数缺失或格式错误',
  401: '登录已失效，请重新登录',
  403: '无权限访问（仅本人 / 本组 / 全中心可见）',
  404: '资源不存在',
  409: '状态冲突（已发布数据不可修改）',
  422: '业务规则校验未通过',
  500: '服务端异常，请稍后重试',
  504: 'AI 服务超时或不可用',
};

/** 降级提示：504/500 时前端切换为手工模式，主流程不阻塞（PRD §12） */
export function toUserMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message || DEFAULT_MSG[err.code] || '请求失败';
  if (err instanceof Error) return err.message;
  return '请求失败';
}

/** 是否为可降级错误（用于 AI 链路降级决策） */
export const isDegradable = (err: unknown): boolean =>
  err instanceof ApiError && (err.code === 504 || err.code === 500);

export const toApiError = (status: number, body?: Partial<ApiErrorBody>): ApiError =>
  new ApiError(status, body?.message || DEFAULT_MSG[status] || '请求失败');
