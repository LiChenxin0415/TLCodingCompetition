/** 复制全文（OVR-08）与导出 .txt（文件名 团队周报_YYYY-Www.txt） */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 降级到 execCommand */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, content: string): void {
  // 加 BOM，避免 Windows 记事本打开 UTF-8 中文乱码
  const blob = new Blob(['﻿', content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 把团队周报四段结构拼成纯文本（复制全文与导出共用，OVR-08） */
export function buildSummaryText(
  week: string,
  summary: { overall: string; achievements: string[]; risks: string[]; nextFocus: string[] },
): string {
  const lines: string[] = [];
  lines.push(`团队周报 · ${week}`);
  lines.push('');
  lines.push('整体进展：');
  lines.push(summary.overall || '（暂无）');
  lines.push('');
  lines.push('关键成果：');
  (summary.achievements.length ? summary.achievements : ['（暂无）']).forEach((i) => lines.push(`- ${i}`));
  lines.push('');
  lines.push('风险集中点：');
  (summary.risks.length ? summary.risks : ['本周无明显风险']).forEach((i) => lines.push(`- ${i}`));
  lines.push('');
  lines.push('下周重点：');
  (summary.nextFocus.length ? summary.nextFocus : ['（暂无）']).forEach((i) => lines.push(`- ${i}`));
  return lines.join('\n');
}

/** 列表摘要：取 weekDone[0] 截断 20 字（需求 4.4） */
export function summaryOf(weekDone: string[] | undefined): string {
  const first = (weekDone ?? [])[0] ?? '';
  return first.length > 20 ? `${first.slice(0, 20)}…` : first;
}
