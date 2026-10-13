/**
 * 全局轻量状态（Zustand）
 * 需求依据：frontend-design §3 状态层 —— 仅存 user / token / week
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { currentWeek } from '../utils/week';
import { writeToken } from '../services/http';

interface AuthState {
  token: string | null;
  user: User | null;
  /** 服务端权威当前周次（GET /api/health），失败时用本地 ISO 周兜底 */
  week: string;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setWeek: (week: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      week: currentWeek(),
      setAuth: (token, user) => {
        writeToken(token);
        set({ token, user });
      },
      clearAuth: () => {
        writeToken(null);
        set({ token: null, user: null });
      },
      setWeek: (week) => set({ week }),
    }),
    {
      name: 'tl_auth',
      // 兼容 401 时被拦截器直接清除的情况
      partialize: (state) => ({ token: state.token, user: state.user, week: state.week }),
    },
  ),
);

export function useCurrentUser(): User | null {
  return useAuthStore((state) => state.user);
}

export function useIsLeader(): boolean {
  return useAuthStore((state) => state.user?.role === 'leader');
}
