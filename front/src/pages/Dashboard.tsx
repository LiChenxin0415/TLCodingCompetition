import { Alert, Button, Card, Col, DatePicker, Radio, Row, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DistributePanel from '@/components/dashboard/DistributePanel';
import DrilldownDrawer from '@/components/dashboard/DrilldownDrawer';
import ItemDetailDrawer from '@/components/dashboard/ItemDetailDrawer';
import MetricCards from '@/components/dashboard/MetricCards';
import ObjectivePanel from '@/components/dashboard/ObjectivePanel';
import RankPanel from '@/components/dashboard/RankPanel';
import ReadinessCard from '@/components/dashboard/ReadinessCard';
import RiskPanel from '@/components/dashboard/RiskPanel';
import { exportLedger, getDrilldown, getOverview } from '@/services/api';
import { useAuth } from '@/store/auth';
import { toUserMessage } from '@/utils/error';
import { currentMonth, monthRange } from '@/utils/rules';
import type { DashboardOverview, DrillLevel, DrilldownRow, MetricKey, PublishReadiness } from '@/types';

/** 加载中的占位：给足三项结构，避免 ReadinessCard 除零得到 NaN */
const EMPTY_READINESS = (m: string): PublishReadiness => ({
  ok: false,
  month: m,
  total_contract: 0,
  published_count: 0,
  checks: [
    { key: 'weight', label: '有效任务权重合计 = 100%', passed: false, detail: '加载中…' },
    { key: 'confirmed', label: '合约与评分全部确认完成', passed: false, detail: '加载中…' },
    { key: 'abnormal', label: '无录入异常（权重/日期/交付物）', passed: false, detail: '加载中…' },
  ],
});

const METRIC_LABEL: Record<MetricKey, string> = {
  total: '工作包总数',
  risk: '风险 / 逾期',
  done: '已完成',
  published: '已发布绩效',
  avgScore: '平均履约得分',
  avgProgress: '整体推进度',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [groupId, setGroupId] = useState<string>(user?.role === 'leader' ? (user?.group_id ?? 'all') : 'all');
  const [level, setLevel] = useState<DrillLevel>('center');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // 下钻态
  const [metric, setMetric] = useState<MetricKey>('total');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rows, setRows] = useState<DrilldownRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [personId, setPersonId] = useState('all');
  const [detailRow, setDetailRow] = useState<DrilldownRow | null>(null);

  const isCenter = user?.role === 'center';
  const isLeader = user?.role === 'leader';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await getOverview(month, groupId, level, personId));
    } catch (e) {
      message.error(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [month, groupId, level, personId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 抽屉打开或切换维度时重新取明细，保证卡上数字 = 明细条数（FR-05 R5）
  useEffect(() => {
    if (!drawerOpen) return;
    let alive = true;
    setRowsLoading(true);
    getDrilldown(metric, month, groupId, level, personId)
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && message.error(toUserMessage(e)))
      .finally(() => alive && setRowsLoading(false));
    return () => {
      alive = false;
    };
  }, [drawerOpen, metric, month, groupId, level, personId]);

  const openDrill = (key: MetricKey) => {
    if (key === 'avgScore' || key === 'avgProgress') return;
    setMetric(key);
    setDrawerOpen(true);
  };

  /** 可选月份：入职月至今（FR-06 R1） */
  const minMonth = useMemo(() => {
    const list = monthRange(user?.join_month ?? '2023-01');
    return dayjs(`${list[list.length - 1]}-01`);
  }, [user?.join_month]);

  const handleExport = async () => {
    try {
      const csv = await exportLedger(month);
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `月度台账_${month}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      message.success('台账已导出');
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const scope = overview?.scope;

  return (
    <div className="dash-root">
      {/* 顶部控制栏 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size={10} align="center">
            <Typography.Title level={4} style={{ margin: 0 }}>
              目标合约驾驶舱
            </Typography.Title>
            {scope && (
              <Tag color="blue">{scope.group_name} · {scope.member_count} 名成员</Tag>
            )}
            {isLeader && <Tag color="green">组长视角：仅本组数据</Tag>}
            {overview && (
              <Tooltip title="数据口径：基于权重与目标值实时聚合，非缓存">
                <span style={{ color: '#bbb', fontSize: 12 }}>更新于 {overview.updated_at}</span>
              </Tooltip>
            )}
          </Space>

          <Space wrap size={8}>
            <DatePicker
              picker="month"
              allowClear={false}
              value={dayjs(`${month}-01`)}
              disabledDate={(cur) => cur.isBefore(minMonth, 'month') || cur.isAfter(dayjs(), 'month')}
              onChange={(d) => setMonth(d ? d.format('YYYY-MM') : currentMonth())}
              style={{ width: 130 }}
            />
            {isCenter && (
              <Radio.Group
                size="small"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                optionType="button"
                options={[
                  { label: '全中心', value: 'all' },
                  ...(overview?.group_options ?? []).map((g) => ({ label: g.group_name, value: g.group_id })),
                ]}
              />
            )}
            <Radio.Group
              size="small"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                if (e.target.value !== 'person') setPersonId('all');
              }}
              optionType="button"
              options={[
                { label: '中心级', value: 'center' },
                { label: '组级', value: 'group' },
                { label: '个人级', value: 'person' },
              ]}
            />
            {level === 'person' && (
              <Select
                size="small"
                style={{ width: 130 }}
                value={personId}
                onChange={setPersonId}
                placeholder="选择成员"
                options={[
                  { value: 'all', label: '全部成员' },
                  ...(overview?.persons ?? []).map((p) => ({ value: p.user_id, label: p.user_name })),
                ]}
              />
            )}
            <Button size="small" onClick={() => void load()} loading={loading}>刷新</Button>
            <Button size="small" onClick={() => void handleExport()}>导出台账</Button>
          </Space>
        </Space>
      </Card>

      {!loading && overview && overview.metrics.every((m) => m.value === 0) ? (
        <Alert
          type="warning"
          showIcon
          message={`${month} 暂无合约数据`}
          description="当前统计范围内没有已创建的合约。可切换到已有数据的月份，或以员工身份创建合约后再回到本页查看。"
        />
      ) : null}

      {/* 指标卡区 */}
      <MetricCards metrics={overview?.metrics ?? []} loading={loading} activeKey={drawerOpen ? metric : undefined} onDrill={openDrill} />

      {/* 主体三栏 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={16}>
          <ObjectivePanel objectives={overview?.objectives ?? []} loading={loading} />
        </Col>
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <ReadinessCard
              readiness={overview?.readiness ?? EMPTY_READINESS(month)}
              loading={loading}
              month={month}
              canCalibrate={isCenter}
            />
            <RiskPanel
              riskTop={overview?.risk_top ?? []}
              loading={loading}
              onDrill={(m) => openDrill(m)}
            />
          </Space>
        </Col>
      </Row>

      {/* 分布 */}
      <div style={{ marginTop: 12 }}>
        <DistributePanel types={overview?.type_slices ?? []} tiers={overview?.tier_slices ?? []} loading={loading} />
      </div>

      {/* 排行 */}
      <div style={{ marginTop: 12 }}>
        <RankPanel
          groups={overview?.groups ?? []}
          persons={overview?.persons ?? []}
          loading={loading}
          lockGroup={isLeader}
          onPickPerson={(uid) => {
            setLevel('person');
            setPersonId(uid);
            setMetric('total');
            setDrawerOpen(true);
          }}
        />
      </div>

      {loading && !overview && <Spin style={{ display: 'block', margin: '48px auto' }} />}

      <DrilldownDrawer
        open={drawerOpen}
        metric={metric}
        metricLabel={METRIC_LABEL[metric]}
        rows={rows}
        loading={rowsLoading}
        level={level}
        personId={personId}
        persons={overview?.persons ?? []}
        onLevelChange={setLevel}
        onPersonChange={setPersonId}
        onClose={() => setDrawerOpen(false)}
        onOpenItem={(r) => setDetailRow(r)}
      />

      <ItemDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
