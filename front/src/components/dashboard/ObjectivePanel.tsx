import { Alert, Card, Col, Empty, Row, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import EmptyState from '@/components/EmptyState';
import ProgressBar from '@/components/ProgressBar';
import type { ObjectiveBoard } from '@/types';

const STATUS_COLOR: Record<ObjectiveBoard['status'], string> = {
  进行中: 'processing',
  已达成: 'success',
  已关闭: 'default',
};

interface Props {
  objectives: ObjectiveBoard[];
  loading: boolean;
}

/**
 * 大目标驾驶舱面板（FR-04 R3/R4）
 * 加权进度 = Σ(工作包进度 × 权重) ÷ Σ(权重)；同时展示每个合约包的贡献占比，
 * 口径唯一可核对（PRD §14 风险「大目标进度口径争议」的缓解措施）。
 */
export default function ObjectivePanel({ objectives, loading }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!loading && objectives.length === 0) {
    return <EmptyState description="当前无可查看的大目标" />;
  }

  return (
    <Card size="small" title="大目标推进概览" loading={loading} className="dash-card">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          <span style={{ fontSize: 12 }}>
            加权进度口径：<code>Σ(工作包进度 × 权重) ÷ Σ(权重)</code>，权重调整后实时重算，非人工填写（FR-04 R3）
          </span>
        }
      />
      <Row gutter={[12, 12]}>
        {objectives.map((o) => {
          const expanded = openId === o.id;
          return (
            <Col xs={24} md={12} key={o.id}>
              <Card
                size="small"
                hoverable
                onClick={() => setOpenId(expanded ? null : o.id)}
                style={{ borderColor: expanded ? '#1677ff' : undefined }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text strong ellipsis={{ tooltip: o.name }} style={{ maxWidth: 220 }}>
                      {o.name}
                    </Typography.Text>
                    <Tag color={STATUS_COLOR[o.status]}>{o.status}</Tag>
                  </Space>

                  <Space size={8} wrap>
                    <span style={{ color: '#999', fontSize: 12 }}>{o.group_name}</span>
                    <span style={{ color: '#999', fontSize: 12 }}>负责人 {o.owner_name}</span>
                    <Tag>{o.link_count} 个关联包</Tag>
                    {o.risk_count > 0 && <Tag color="red">{o.risk_count} 项风险</Tag>}
                  </Space>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <ProgressBar value={o.progress} height={10} />
                    </div>
                    <Tooltip title="Σ(进度×权重) ÷ Σ(权重)">
                      <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: '#1677ff', minWidth: 58, textAlign: 'right' }}>
                        {o.progress}%
                      </span>
                    </Tooltip>
                  </div>

                  <div style={{ color: '#bbb', fontSize: 11 }}>
                    已完成 {o.done_count}/{o.link_count} ｜ 关联合计权重 {o.total_weight}% ｜ 点击{expanded ? '收起' : '查看'}贡献明细
                  </div>

                  {expanded && (
                    <Table
                      size="small"
                      rowKey="item_id"
                      pagination={false}
                      style={{ marginTop: 4 }}
                      locale={{ emptyText: <Empty description="当前无合约包关联" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                      dataSource={o.contributors}
                      columns={[
                        { title: '成员', dataIndex: 'user_name', width: 70 },
                        {
                          title: '工作包', dataIndex: 'item_title', width: 150,
                          render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
                        },
                        { title: '权重', dataIndex: 'weight', width: 60, align: 'right', render: (v: number) => `${v}%` },
                        {
                          title: '进度', dataIndex: 'progress', width: 110,
                          render: (v: number) => <ProgressBar value={v} height={6} showText />,
                        },
                        {
                          title: '贡献占比', dataIndex: 'contribution', width: 100,
                          render: (v: number) => (
                            <span className="mono">
                              <Tag color={v >= 30 ? 'blue' : v >= 15 ? 'cyan' : 'default'}>{v}%</Tag>
                            </span>
                          ),
                        },
                      ]}
                    />
                  )}
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}
