export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const badRequest = (message: string): ApiError => new ApiError(400, message);
export const unauthorized = (message = '登录已失效，请重新登录'): ApiError => new ApiError(401, message);
export const forbidden = (message = '无权限访问'): ApiError => new ApiError(403, message);
export const notFound = (message = '资源不存在'): ApiError => new ApiError(404, message);
export const conflict = (message: string): ApiError => new ApiError(409, message);
export const unprocessable = (message: string): ApiError => new ApiError(422, message);
export const aiTimeout = (message = 'AI 处理超时，请重试'): ApiError => new ApiError(504, message);
export const aiFailed = (message = 'AI 暂不可用，请稍后重试'): ApiError => new ApiError(504, message);