import { create } from 'zustand';
import type { User } from '@/types';

const TOKEN_KEY = 'gct_token';
const USER_KEY = 'gct_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

interface AuthState {
  token: string;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: getToken(),
  user: (() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  })(),
  login: (token, user) => {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    set({ token: '', user: null });
  },
}));
