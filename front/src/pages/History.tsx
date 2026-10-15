import { Alert, Button, Card, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import ItemTable from '@/components/ItemTable';
import { getMyContract, listObjectives } from '@/services/api';
import { useAuth } from '@/store/auth';
import { currentMonth, monthlyScore, monthRange } from '@/utils/rules';
import { normalize } from '@/utils/file';
import { toUserMessage } from '@/utils/error';
import { CONTRACT_STATUS_TEXT, ITEM_TYPES } from '@/types';
import type { ContractItem } from '@/types';

interface TrendPoint {
  month: string;
  score: number;
  typeWeight: Record<string, number>;
}

export default function History() {
  const { user } = useAuth();
  const months = useMemo(() => (user ? monthRange(user.join_month) : [currentMonth()]), [user]);
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyContract>> | null>(null);
  const [objectives, setObjectives] = useState<{ id: string; name: string }[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listObjectives().then((o) => setObjectives(o.map((x) => ({ id: x.id, name: x.name }))));
  }, []);

  const loadMonth = async () => {
    setLoading(true);
    try {
      setData(await getMyContract(month));
    } catch (e) {
      message.error(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const loadTrend = async () => {
    const list = months.slice(0, 6).reverse();
    const res: TrendPoint[] = [];
    for (const m of list) {
      try {
        const d = await getMyContract(m);
        if (!d.contract) continue;
        const tw: Record<string, number> = {};
        d.items.forEach((i) => {
          tw[i.type] = (tw[i.type] ?? 0) + i.weight;
        });
        res.push({ month: m, score: d.contract.score ?? monthlyScore(d.items), typeWeight: tw });
      } catch {
        // 忽略无合约月份
      }
    }
    setTrend(res);
  };

  useEffect(() => {
    void loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    void loadTrend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const published = data?.contract?.status === 'published';
  const readonly = Boolean(data?.contract) && data!.contract!.month !== currentMonth();

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} className="page-title">
          合约历史（按月查看）
        </Typography.Title>
        <Select
          value={month}
          style={{ width: 160 }}
          onChange={(v) => setMonth(v)}
          options={months.map((m) => ({ value: m, label: m }))}
        />
      </Space>

      {readonly && <Alert type="warning" showIcon message="非当月合约一律只读；已发布月份编辑、上传、评分入口全部隐藏（FR-06 R2）" />}

      <Card size="small" loading={loading}>
        {!data?.contract ? (
          <EmptyState description={`${month} 暂无合约`} extra={<Button onClick={() => setMonth(currentMonth())}>回到当前月</Button>} />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={24}>
              <Statistic title="月度得分" value={data.contract.score ?? monthlyScore(data.items)} />
              <Statistic title="状态" value={CONTRACT_STATUS_TEXT[data.contract.status]} />
              <Statistic title="工作包数" value={data.items.length} />
              {published && <Statistic title="发布时间" value={data.contract.publish_at ?? '—'} />}
            </Space>
            <ItemTable
              items={data.items}
              deliverables={data.deliverables}
              objectives={objectives}
              readonly
            />
          </Space>
        )}
      </Card>

      <Card size="small" title="跨月对比（FR-06 R3）">
        {trend.length === 0 ? (
          <EmptyState description="暂无历史月份数据" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <div className="section-label">月度得分趋势</div>
              <Space align="end" size={16}>
                {normalize(trend.map((t) => t.score)).map((h, idx) => (
                  <div key={trend[idx].month} style={{ textAlign: 'center' }}>
                    <div style={{ height: 100, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: 36, height: `${h}%`, background: '#1677ff', borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 12 }}>{trend[idx].month.slice(5)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{trend[idx].score}</div>
                  </div>
                ))}
              </Space>
            </div>
            <div>
              <div className="section-label">任务类型权重占比趋势</div>
              <Table
                size="small"
                pagination={false}
                rowKey={(r: TrendPoint) => r.month}
                dataSource={trend}
                scroll={{ x: 720 }}
                columns={[
                  { title: '月份', dataIndex: 'month', width: 110 },
                  ...ITEM_TYPES.map((t) => ({
                    title: t,
                    key: t,
                    width: 150,
                    render: (_: unknown, r: TrendPoint) => {                      const v = r.typeWeight[t] ?? 0;
                      return (
                        <Space size={6}>
                          <Tag color={v ? 'blue' : 'default'}>{v}%</Tag>
                          <div style={{ width: 60, background: '#f0f0f0', height: 6, borderRadius: 3 }}>
                            <div style={{ width: `${v}%`, height: '100%', background: '#1677ff' }} />
                          </div>
                        </Space>
                      );
                    },
                  })),
                ]}
              />
            </div>
          </Space>
        )}
      </Card>
    </Space>
  );
}

// 仅用于类型提示：ItemTable 接收的只读 items
export type { ContractItem };
