import { Popover, Tag } from 'antd';

interface Props {
  /** 风险条目；为空或 ["暂无"] 视为无风险（TPL-03） */
  issues?: string[];
  /** 本周是否未开始（无周报同样标 ⚠，OVR-01） */
  notStarted?: boolean;
}

export function hasRisk(issues?: string[], notStarted?: boolean): boolean {
  if (notStarted) return true;
  return (issues ?? []).some((i) => i && i !== '暂无');
}

/** 风险 ⚠ 标签：点击展开条目（OVR-01） */
export default function RiskTag({ issues, notStarted }: Props) {
  const list = (issues ?? []).filter((i) => i && i !== '暂无');

  if (notStarted) return <Tag color="warning">⚠ 未开始</Tag>;
  if (!list.length) return <Tag color="default">暂无</Tag>;

  return (
    <Popover
      content={
        <ul style={{ margin: 0, paddingLeft: 18, maxWidth: 280 }}>
          {list.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ul>
      }
    >
      <Tag color="warning" style={{ cursor: 'pointer' }}>
        ⚠ {list.length} 项风险
      </Tag>
    </Popover>
  );
}
