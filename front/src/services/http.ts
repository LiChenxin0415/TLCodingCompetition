/**
 * Axios 实例与统一错误处理
 * 需求依据：frontend-design §7「错误码统一处理」、第七章边界场景
 *   - 401 → 清 token 跳登录（AUTH-03）
 *   - 403 → 「无权限访问」（AUTH-02）
 *   - 400 / 504 / 500 / 网络异常 → 统一文案
 *   - 禁止向前端展示后端原始报错（6.3）
 */

import axios from 'axios';
import type { AxiosError } from 'axios';
import type { ApiFailure } from '../types';

export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

/** 原始 token 单独存一份，供请求拦截器读取（避免与 zustand 持久化结构耦合） */
export const TOKEN_STORAGE_KEY = 'tl_token';

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage 不可用时忽略（隐私模式）
  }
}

export const http = axios.create({
  baseURL: API_BASE,
  timeout: 30_000, // 大于 AI 的 20s 上限（GEN-04），避免前端先超时
});

http.interceptors.request.use((config) => {
  const token = readToken();
  if (token !== null && token !== '') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 按状态码给出统一文案（不暴露后端原始报错细节） */
export function messageOf(status: number, backendMessage?: string): string {
  switch (status) {
    case 400:
      return backendMessage !== undefined && backendMessage !== '' ? backendMessage : '请求参数有误';
    case 401:
      return '登录已失效，请重新登录';
    case 403:
      return '无权限访问';
    case 404:
      return backendMessage !== undefined && backendMessage !== '' ? backendMessage : '资源不存在';
    case 504:
      return '生成失败，请重试';
    case 500:
      return '服务异常，请稍后重试';
    default:
      return backendMessage !== undefined && backendMessage !== '' ? backendMessage : '服务异常，请稍后重试';
  }
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status ?? 0;
    const backendMessage = error.response?.data?.message;

    // 401：清登录态并跳登录页（AUTH-03）
    if (status === 401) {
      writeToken(null);
      try {
        window.localStorage.removeItem('tl_auth');
      } catch {
        // 忽略
      }
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
    }

    const failure: ApiFailure = {
      status,
      message:
        status === 0
          ? '无法连接后端服务，请确认已在 back/ 目录执行 npm start（默认 http://localhost:3000）'
          : messageOf(status, backendMessage),
    };
    return Promise.reject(failure);
  },
);

/** 供页面 catch 使用：把任意异常转成可展示文案 */
export function failureMessage(error: unknown): string {
  const failure = error as ApiFailure | undefined;
  if (failure !== undefined && typeof failure.status === 'number' && typeof failure.message === 'string') {
    return failure.message;
  }
  return '操作失败，请稍后重试';
}

export function failureStatus(error: unknown): number {
  const failure = error as ApiFailure | undefined;
  return failure !== undefined && typeof failure.status === 'number' ? failure.status : 0;
}
