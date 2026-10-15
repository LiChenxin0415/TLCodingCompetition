import { Alert, Button, Card, Col, Drawer, Input, Radio, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import RiskTag from '@/components/RiskTag';
import { getDrilldown, getMetrics } from '@/services/api';
import { useAuth } from '@/store/auth';
import { db } from '@/services/seed';
import { toUserMessage } from '@/utils/error';
import { currentMonth } from '@/utils/rules';
import type { DrilldownRow } from '@/types';

const METRIC_TIP: Record<string, string> = {
  total: '当期全部工作包（按截止日升序）',
  risk: '仅风险与逾期工作包（按风险等级降序）',
  done: '进度 = 100% 的工作包（按完成时间倒序）',
  published: '已发布成员的合约与得分（按得分降序）',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [groupId, setGroupId] = useState(user?.role === 'leader' ? (user?.group_id ?? 'all') : 'all');
  const [level, setLevel] = useState<'center' | 'group' | 'person'>('center');
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getMetrics>>>([]);
  const [open, setOpen] = useState(false);
  const [currentMetric, setCurrentMetric] = useState<'total' | 'risk' | 'done' | 'published'>('total');
  const [rows, setRows] = useState<DrilldownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DrilldownRow | null>(null);

  const loadMetrics = async () => {
    try {
      setMetrics(await getMetrics(month, groupId));
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  useEffect(() => {
    void loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, groupId]);

  const drill = async (metric: 'total' | 'risk' | 'done' | 'published') => {
    setCurrentMetric(metric);
    setLoading(true);
    setOpen(true);
    try {
      setRows(await getDrilldown(metric, month, groupId));
    } catch (e) {
      message.error(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const filtered = level === 'person' && rows.length ? rows : rows;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} className="page-title">
          部门看板
        </Typography.Title>
        <Space>
          <Input.Search placeholder="YYYY-MM" enterButton="切换" defaultValue={month} onSearch={(v) => setMonth(v || month)} style={{ width: 220 }} />
          {user?.role === 'center' && (
            <Radio.Group value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <Radio.Button value="all">全中心</Radio.Button>
              {db.groups.filter((g) => g.id !== 'grp_root').map((g) => (
                <Radio.Button key={g.id} value={g.id}>
                  {g.name}
                </Radio.Button>
              ))}
            </Radio.Group>
          )}
        </Space>
      </Space>

      <Alert type="info" showIcon message="点击指标卡即可下钻；卡上的数字必须与下钻明细条数一致（FR-05 R5）" />

      <Row gutter={[12, 12]}>
        {metrics.map((m) => (
          <Col xs={12} md={6} key={m.key}>
            <Card hoverable onClick={() => void drill(m.key as 'total')} style={{ cursor: 'pointer' }}>
              <Statistic title={m.label} value={m.value} suffix={<span style={{ fontSize: 12, color: '#bbb' }}>{METRIC_TIP[m.key]?.slice(0, 0)}</span>} />
              <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>{METRIC_TIP[m.key]}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title="大目标加权进度">
        <Space direction="vertical" style={{ width: '100%' }}>
          {db.objectives.map((o) => (
            <Row key={o.id} align="middle" gutter={12}>
              <Col span={10}>{o.name}</Col>
              <Col span={10}>
                <ProgressLine value={o.progress} />
              </Col>
              <Col span={4}>{o.progress}%</Col>
            </Row>
          ))}
        </Space>
      </Card>

      <Drawer
        open={open}
        title={`${metrics.find((m) => m.key === currentMetric)?.label ?? ''} · 下钻明细（${rows.length} 条）`}
        width={1100}
        onClose={() => setOpen(false)}
        extra={
          <Radio.Group value={level} onChange={(e) => setLevel(e.target.value)}>
            <Radio.Button value="center">中心</Radio.Button>
            <Radio.Button value="group">组</Radio.Button>
            <Radio.Button value="person">个人</Radio.Button>
          </Radio.Group>
        }
      >
        {!loading && rows.length === 0 ? (
          <EmptyState description="该指标下暂无明细" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={loading}
            pagination={false}
            scroll={{ x: 1200 }}
            dataSource={filtered}
            columns={[
              { title: '成员', dataIndex: 'user_name', width: 90 },
              { title: '工作包', dataIndex: 'item_title', width: 180 },
              { title: '类型', dataIndex: 'type', width: 100 },
              { title: '大目标', dataIndex: 'objective_name', width: 180 },
              { title: '权重', dataIndex: 'weight', width: 80, align: 'right', render: (v: number) => `${v}%` },
              { title: '进度', dataIndex: 'progress', width: 150, render: (v: number) => <ProgressLine value={v} /> },
              { title: '截止日', dataIndex: 'due_date', width: 110 },
              { title: '风险状态', dataIndex: 'risk_status', width: 90, render: (v: '正常' | '风险' | '逾期') => <RiskTag status={v} /> },
              {
                title: '交付物',
                dataIndex: 'deliverable_status',
                width: 100,
                render: (v: string) => <Tag color={v === '已上传' ? 'green' : 'red'}>{v}</Tag>,
              },
              {
                title: '操作',
                key: 'op',
                width: 80,
                render: (_, r: DrilldownRow) => (
                  <Button type="link" size="small" onClick={() => setDetail(r)}>
                    详情
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      <Drawer open={Boolean(detail)} title="工作包详情（只读）" width={520} onClose={() => setDetail(null)}>
        {detail && (
          <Space direction="vertical">
            <Typography.Text strong>{detail.item_title}</Typography.Text>
            <Typography.Text type="secondary">{detail.type} · {detail.objective_name}</Typography.Text>
            <div>成员：{detail.user_name}</div>
            <div>权重：{detail.weight}% ｜ 进度：{detail.progress}%</div>
            <div>截止日：{detail.due_date} ｜ 风险：<RiskTag status={detail.risk_status} /></div>
            <div>交付物：{detail.deliverable_status}</div>
            <div>评分：{typeof detail.score === 'number' ? `${detail.score} 分` : '未评分'}</div>
            <Alert type="info" showIcon message="明细含进度留痕、交付物、变更记录（只读，FR-05 R3）" />
          </Space>
        )}
      </Drawer>
    </Space>
  );
}

function ProgressLine({ value }: { value: number }) {
  return (
    <div style={{ background: '#f0f0f0', height: 8, borderRadius: 4, overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: '100%',
          background: value >= 100 ? '#52c41a' : '#1677ff',
        }}
      />
    </div>
  );
}
