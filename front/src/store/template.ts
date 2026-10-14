import { create } from 'zustand';
import type { TemplateField } from '@/types';
import { getTemplate } from '@/services/api';

/** 兜底模板：接口未就绪时页面依然可用（结构与 TPL-01 一致） */
const FALLBACK: TemplateField[] = [
  { key: 'weekDone', label: '本周完成', required: true, maxItems: 5, maxLen: 50 },
  { key: 'ongoing', label: '进行中', required: true, maxItems: 3, maxLen: 50 },
  { key: 'issues', label: '问题与风险', required: false, maxItems: 3, maxLen: 50 },
  { key: 'nextPlan', label: '下周计划', required: true, maxItems: 3, maxLen: 50 },
];

interface TemplateState {
  fields: TemplateField[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  fields: FALLBACK,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const fields = await getTemplate();
      if (fields?.length) set({ fields, loaded: true });
    } catch {
      // 拉取失败沿用兜底模板，保证演示不中断
      set({ loaded: true });
    }
  },
}));
