/**
 * 风险 ⚠ 标签（OVR-01）
 * 判定：issues 非空且不为「暂无」→ 有风险；「未开始」（无周报）同样标 ⚠
 * 交互：点击/悬停可查看具体风险条目
 */

import { Popover, Tag, Typography } from 'antd';

interface Props {
  items?: string[];
  /** 无周报（未开始）也视为管理风险 */
  notStarted?: boolean;
}

export default function RiskTag({ items, notStarted = false }: Props): JSX.Element {
  const risks = (items ?? []).filter((item) => {
    const text = item.trim();
    return text !== '' && text !== '暂无';
  });

  if (notStarted) {
    return (
      <Popover content={<Typography.Text>本周未提交周报（未开始）</Typography.Text>}>
        <Tag color="warning" style={{ cursor: 'pointer' }}>
          ⚠ 未开始
        </Tag>
      </Popover>
    );
  }

  if (risks.length === 0) {
    return <Typography.Text type="secondary">无</Typography.Text>;
  }

  return (
    <Popover
      title="问题与风险"
      content={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {risks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      }
    >
      <Tag color="warning" style={{ cursor: 'pointer' }}>
        ⚠ 风险 {risks.length > 1 ? `(${risks.length})` : ''}
      </Tag>
    </Popover>
  );
}
