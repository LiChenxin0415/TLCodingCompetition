import { create } from 'zustand';

interface DirtyState {
  dirty: boolean;
  setDirty: (v: boolean) => void;
}

/** 编辑区未保存标记：切换账号 / 离开页面前用于弹「未保存的修改将丢失」（第七章 / TC-EDGE-01） */
export const useDirtyStore = create<DirtyState>((set) => ({
  dirty: false,
  setDirty: (v) => set({ dirty: v }),
}));
