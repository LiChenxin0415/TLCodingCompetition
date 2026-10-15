/** 前端小工具：导出文本、纯 CSS 迷你折线/柱状图数据归一 */

export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  // BOM：Excel 打开中文不乱码
  const blob = new Blob(['\uFEFF' + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 归一化到 [0,100]，用于迷你柱状图 */
export function normalize(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map((v) => Math.max(4, Math.round((v / max) * 100)));
}

export function pct(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}
