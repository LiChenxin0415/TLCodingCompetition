import { Tag } from 'antd';

const MAP: Record<'正常' | '风险' | '逾期', { color: string; text: string }> = {
  正常: { color: 'green', text: '正常' },
  风险: { color: 'orange', text: '风险' },
  逾期: { color: 'red', text: '逾期' },
};

/** 风险/逾期标签（FR-05 下钻、看板卡片共用） */
export default function RiskTag({ status }: { status: '正常' | '风险' | '逾期' }) {
  const m = MAP[status] ?? MAP['正常'];
  return <Tag color={m.color}>{m.text}</Tag>;
}
