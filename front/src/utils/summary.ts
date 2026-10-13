/**
 * 复制与下载工具（OVR-08）
 */

import type { TeamSummary } from '../types';

/** 四段纯文本（与后端导出格式一致，用于「复制全文」） */
export function summaryToText(summary: TeamSummary): string {
  return [
    '整体进展：',
    summary.overall,
    '',
    '关键成果：',
    ...summary.achievements.map((item) => `- ${item}`),
    '',
    '风险集中点：',
    ...summary.risks.map((item) => `- ${item}`),
    '',
    '下周重点：',
    ...summary.nextFocus.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

/** 复制到剪贴板，返回是否成功（claude 环境无剪贴板权限时降级为手动提示） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined && navigator.clipboard !== null) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续走兜底方案
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** 触发浏览器下载（OVR-08 导出 .txt） */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
