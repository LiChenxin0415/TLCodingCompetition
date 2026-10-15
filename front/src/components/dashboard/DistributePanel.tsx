import { Card, Col, Empty, Row, Space, Tooltip, Typography } from 'antd';
import type { TierSlice, TypeSlice } from '@/types';

/** 四类任务配色（与 PRD FR-02 枚举顺序一致） */
const TYPE_COLOR: Record<string, string> = {
  基础履职类: '#8c8c8c',
  重点交付类: '#1677ff',
  治理改善类: '#52c41a',
  探索突破类: '#722ed1',
};

interface Props {
  types: TypeSlice[];
  tiers: TierSlice[];
  loading: boolean;
}

/** 横向分布条：不引入图表库，保持包体精简，语义直观 */
function Bar({ label, value, total, color, suffix = '个' }: { label: string; value: number; total: number; color: string; suffix?: string }) {
  const pctOf = total ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span style={{ color: '#666' }}>{label}</span>
        <span className="mono" style={{ color: '#999' }}>
          {value}{suffix} · {Math.round(pctOf * 10) / 10}%
        </span>
      </div>
      <div style={{ background: '#f0f0f0', height: 10, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pctOf}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

/** 任务类型分布 + 评分档位分布（FR-02 R1 四类枚举 / FR-09 评分档位表） */
export default function DistributePanel({ types, tiers, loading }: Props) {
  const typeTotal = types.reduce((s, t) => s + t.count, 0);
  const tierTotal = tiers.reduce((s, t) => s + t.count, 0);

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={12}>
        <Card size="small" title="四类任务分布" loading={loading} className="dash-card">
          {typeTotal === 0 ? (
            <Empty description="暂无工作包数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              {types.map((t) => (
                <Tooltip key={t.type} title={`${t.count} 个 · 合计权重 ${t.weight}% · 平均进度 ${t.avg_progress}%`}>
                  <div>
                    <Bar label={t.type} value={t.count} total={typeTotal} color={TYPE_COLOR[t.type] ?? '#1677ff'} />
                  </div>
                </Tooltip>
              ))}
              <Space size={12} wrap style={{ marginTop: 8, color: '#bbb', fontSize: 11 }}>
                {types.filter((t) => t.count > 0).map((t) => (
                  <span key={t.type}>
                    {t.type} 权重 {t.weight}% · 进度 {t.avg_progress}%
                  </span>
                ))}
              </Space>
            </>
          )}
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title="评分档位分布" loading={loading} className="dash-card">
          {tierTotal === 0 ? (
            <Empty description="本月尚无评分数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              {tiers.filter((t) => t.count > 0).map((t) => (
                <Tooltip key={t.tier} title={`${t.range} 分：${t.tier}`}>
                  <div>
                    <Bar label={`${t.range} ${t.tier}`} value={t.count} total={tierTotal} color={t.color} suffix="项" />
                  </div>
                </Tooltip>
              ))}
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                评分区间 80–120；偏离 100 分必须填写依据，无交付物上限 95 分（FR-09 R1/R4）
              </Typography.Text>
            </>
          )}
        </Card>
      </Col>
    </Row>
  );
}
