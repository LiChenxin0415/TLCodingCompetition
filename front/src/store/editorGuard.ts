/**
 * 未保存编辑守卫（第七章：切换账号/离开页面前提示「未保存的修改将丢失」）
 * 用法：编辑页在内容变化时 setDirty(true)，保存成功后 setDirty(false)；
 *       TopNav 与浏览器关闭前统一读取该标记。
 */

import { create } from 'zustand';

interface EditorGuardState {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

export const useEditorGuard = create<EditorGuardState>((set) => ({
  dirty: false,
  setDirty: (dirty) => set({ dirty }),
}));
