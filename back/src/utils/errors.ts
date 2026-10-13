/**
 * 统一错误与错误码
 * 需求依据：6.2 统一错误码表、第八章（统一响应体 { code, message }）
 *
 * 注意：本文件不使用 TS 参数属性/枚举等不可擦除语法，保证 node 可直接运行 .ts
 * （Node 24 原生类型擦除，见 back/README.md「运行方式」）。
 */

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** 400 参数缺失 / 超长 / 格式错误（GEN-01、空可汇总） */
export const badRequest = (message: string): ApiError => new ApiError(400, message);

/** 401 未登录 / token 失效（AUTH-03） */
export const unauthorized = (message = '登录已失效，请重新登录'): ApiError => new ApiError(401, message);

/** 403 越权访问他人资源（AUTH-02） */
export const forbidden = (message = '无权限访问'): ApiError => new ApiError(403, message);

export const notFound = (message = '资源不存在'): ApiError => new ApiError(404, message);

/** 504 AI 生成超时（GEN-04/06）或生成失败（网络/解析失败视同失败，6.3） */
export const aiTimeout = (message = 'AI 生成超时，请重试'): ApiError => new ApiError(504, message);

export const aiFailed = (message = '生成失败，请重试'): ApiError => new ApiError(504, message);
