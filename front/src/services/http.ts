import axios, { type AxiosRequestConfig } from 'axios';
import { getToken } from '@/store/auth';
import { toApiError } from '@/utils/error';

/** HLD §7：Base /api，Bearer Token，统一错误体 {code,message} */
const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

http.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status: number = err.response?.status ?? 0;
    if (status === 401) {
      // 401 由页面守卫统一跳转登录，此处仅清 token
      localStorage.removeItem('gct_token');
    }
    return Promise.reject(toApiError(status, err.response?.data));
  },
);

export async function request<T>(cfg: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(cfg);
  return res.data;
}

export const get = <T,>(url: string, params?: Record<string, unknown>) =>
  request<T>({ url, method: 'GET', params });

export const post = <T,>(url: string, data?: unknown) =>
  request<T>({ url, method: 'POST', data });

export const put = <T,>(url: string, data?: unknown) =>
  request<T>({ url, method: 'PUT', data });

export const del = <T,>(url: string) => request<T>({ url, method: 'DELETE' });

export default http;
