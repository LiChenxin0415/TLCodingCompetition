import { ApiError } from '@/types';

export const HOME_BY_ROLE: Record<string, string> = {
  member: '/report/edit',
  leader: '/team/reports',
};

/**
 * 错误码 → 用户可见文案（api-spec-v1.md 第九节 / ui-design-v1.md 三态规范）
 * 禁止把原始报错直接暴露给用户（需求 6.3）
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 400:
        return error.message || '参数有误，请检查后重试';
      case 401:
        return '登录已失效，请重新登录';
      case 403:
        return '无权限访问';
      case 504:
        return '生成超时，请重试';
      default:
        return '服务异常，请稍后重试';
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return '服务异常，请稍后重试';
}

export function isAiTimeout(error: unknown): boolean {
  return error instanceof ApiError && error.code === 504;
}
