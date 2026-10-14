import axios, { AxiosError } from 'axios';
import { ApiError } from '@/types';
import { getToken, clearToken } from '@/store/auth';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 25000, // AI 接口服务端 20s 超时（504），前端留 5s 余量
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** 统一错误转换：HTTP → ApiError（不向用户暴露原始报错，需求 6.3） */
http.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError<{ code?: number; message?: string }>) => {
    const status = error.response?.status ?? 0;
    const serverMsg = error.response?.data?.message;

    if (status === 401) {
      clearToken();
      if (!location.hash.includes('/login') && location.pathname !== '/login') {
        location.href = '/login';
      }
      return Promise.reject(new ApiError(401, serverMsg || '登录已失效，请重新登录'));
    }

    if (status === 403) return Promise.reject(new ApiError(403, serverMsg || '无权限访问'));
    if (status === 504) return Promise.reject(new ApiError(504, serverMsg || '生成超时，请重试'));
    if (status === 400) return Promise.reject(new ApiError(400, serverMsg || '参数有误，请检查后重试'));
    if (status === 500) return Promise.reject(new ApiError(500, serverMsg || '服务异常，请稍后重试'));

    if (error.code === 'ECONNABORTED') return Promise.reject(new ApiError(504, '请求超时，请重试'));
    if (!error.response) return Promise.reject(new ApiError(0, '网络异常，请检查网络后重试'));
    return Promise.reject(new ApiError(status, serverMsg || '服务异常，请稍后重试'));
  },
);
