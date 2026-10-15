import { Button, Card, Empty, Space, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '@/components/ProgressBar';
import RiskTag from '@/components/RiskTag';
import type { DrilldownRow } from '@/types';

interface Props {
  riskTop: DrilldownRow[];
  loading: boolean;
  onDrill: (metric: 'risk') => void;
}

/**
 * 风险 / 逾期 TOP5（FR-05 下钻 + PRD §12「风险项提前 5 天预警」）
 * 点击「查看全部」跳转下钻明细，条数与看板卡片保持一致。
 */
export default function RiskPanel({ riskTop, loading, onDrill }: Props) {
  const nav = useNavigate();

  return (
    <Card
      size="small"
      title={<Space size={6}><span>风险与逾期 TOP5</span><Tag color="red">{riskTop.length}</Tag></Space>}
      loading={loading}
      className="dash-card"
      extra={
        <Space size={4}>
          <Button size="small" type="link" onClick={() => onDrill('risk')}>查看全部</Button>
        </Space>
      }
    >
      {!loading && riskTop.length === 0 ? (
        <Empty description="本月无风险/逾期工作包" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          {riskTop.map((r, idx) => (
            <div
              key={r.id}
              onClick={() => nav(`/items/${r.id}`)}
              className="clickable-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px',
                borderBottom: idx === riskTop.length - 1 ? 'none' : '1px solid #f0f0f0',
                borderRadius: 6,
              }}
            >
              <span className="mono" style={{ color: '#bbb', width: 18, flexShrink: 0 }}>{idx + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Typography.Text strong ellipsis style={{ maxWidth: 190 }}>{r.item_title}</Typography.Text>
                  <RiskTag status={r.risk_status} />
                </div>
                <div style={{ color: '#999', fontSize: 12 }}>
                  <Tooltip title={r.objective_name === '—' ? '暂未关联大目标' : r.objective_name}>
                    <span>{r.user_name} · {r.type}</span>
                  </Tooltip>
                  {' ｜ 截止 '}
                  <span className="mono">{r.due_date}</span>
                  {' ｜ 权重 '}
                  <span className="mono">{r.weight}%</span>
                </div>
              </div>
              <div style={{ width: 110, flexShrink: 0 }}>
                <ProgressBar value={r.progress} height={8} showText />
              </div>
              {r.deliverable_status === '未上传' && (
                <Tooltip title="缺交付物，月末评分上限 95 分">
                  <Tag color="orange" style={{ margin: 0 }}>缺物</Tag>
                </Tooltip>
              )}
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}
