import { Button, Drawer, Empty, Input, Radio, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import ProgressBar from '@/components/ProgressBar';
import RiskTag from '@/components/RiskTag';
import type { DrillLevel, DrilldownRow, MetricKey, PersonStat } from '@/types';

interface Props {
  open: boolean;
  metric: MetricKey;
  metricLabel: string;
  rows: DrilldownRow[];
  loading: boolean;
  level: DrillLevel;
  personId: string;
  persons: PersonStat[];
  onLevelChange: (level: DrillLevel) => void;
  onPersonChange: (userId: string) => void;
  onClose: () => void;
  onOpenItem: (row: DrilldownRow) => void;
}

/** 下钻排序口径（FR-05 指标与下钻映射表） */
const METRIC_HINT: Record<MetricKey, string> = {
  total: '当期全部工作包 · 按截止日升序',
  risk: '仅风险与逾期工作包 · 按风险等级降序',
  done: '进度 = 100% 的工作包 · 按完成时间倒序',
  published: '已发布成员的合约与得分 · 按得分降序',
  avgScore: '概览指标，不支持下钻',
  avgProgress: '概览指标，不支持下钻',
};

/**
 * 下钻抽屉（FR-05）
 * R1 支持中心/组/个人三级切换；R2 明细列固定九项；R5 卡上数字必须与本列表条数一致。
 */
export default function DrilldownDrawer({
  open, metric, metricLabel, rows, loading, level, personId, persons,
  onLevelChange, onPersonChange, onClose, onOpenItem,
}: Props) {
  const [kw, setKw] = useState('');

  useEffect(() => {
    if (!open) setKw('');
  }, [open]);

  const filtered = rows.filter((r) => {
    if (!kw.trim()) return true;
    const k = kw.trim().toLowerCase();
    return (
      r.user_name.toLowerCase().includes(k) ||
      r.item_title.toLowerCase().includes(k) ||
      r.objective_name.toLowerCase().includes(k) ||
      r.type.includes(k)
    );
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1180}
      title={
        <Space size={8} wrap>
          <span>{metricLabel} · 下钻明细</span>
          <Tag color="blue">{rows.length} 条</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            {METRIC_HINT[metric]}
          </Typography.Text>
        </Space>
      }
      extra={
        <Space>
          <Radio.Group size="small" value={level} onChange={(e) => onLevelChange(e.target.value)}>
            <Radio.Button value="center">中心</Radio.Button>
            <Radio.Button value="group">组</Radio.Button>
            <Radio.Button value="person">个人</Radio.Button>
          </Radio.Group>
          {level === 'person' && (
            <Select
              size="small"
              style={{ width: 140 }}
              value={personId}
              onChange={onPersonChange}
              options={[{ value: 'all', label: '全部成员' }, ...persons.map((p) => ({ value: p.user_id, label: p.user_name }))]}
            />
          )}
        </Space>
      }
    >
      <Input.Search
        allowClear
        placeholder="搜索成员 / 工作包 / 大目标 / 类型"
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        style={{ marginBottom: 10, maxWidth: 340 }}
      />

      {!loading && rows.length === 0 ? (
        <EmptyState description="该指标下暂无明细数据" />
      ) : (
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          pagination={rows.length > 20 ? { pageSize: 20, size: 'small' } : false}
          scroll={{ x: 1240 }}
          dataSource={filtered}
          locale={{ emptyText: <Empty description="无匹配结果" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          columns={[
            { title: '成员', dataIndex: 'user_name', width: 80, fixed: 'left' },
            {
              title: '工作包', dataIndex: 'item_title', width: 166,
              render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
            },
            {
              title: '类型', dataIndex: 'type', width: 92,
              filters: [...new Set(rows.map((r) => r.type))].map((t) => ({ text: t, value: t })),
              onFilter: (v, r) => r.type === v,
            },
            {
              title: '大目标', dataIndex: 'objective_name', width: 158,
              render: (v: string) => (v === '—' ? <span style={{ color: '#ccc' }}>未关联</span> : v),
            },
            {
              title: '权重', dataIndex: 'weight', width: 70, align: 'right',
              sorter: (a, b) => a.weight - b.weight,
              render: (v: number) => `${v}%`,
            },
            {
              title: '进度', dataIndex: 'progress', width: 140,
              sorter: (a, b) => a.progress - b.progress,
              render: (v: number) => <ProgressBar value={v} height={8} showText />,
            },
            {
              title: '截止日', dataIndex: 'due_date', width: 100,
              sorter: (a, b) => a.due_date.localeCompare(b.due_date),
            },
            {
              title: '风险状态', dataIndex: 'risk_status', width: 86,
              filters: [
                { text: '正常', value: '正常' }, { text: '风险', value: '风险' }, { text: '逾期', value: '逾期' },
              ],
              onFilter: (v, r) => r.risk_status === v,
              render: (v: DrilldownRow['risk_status']) => <RiskTag status={v} />,
            },
            {
              title: '交付物', dataIndex: 'deliverable_status', width: 92,
              filters: [{ text: '已上传', value: '已上传' }, { text: '未上传', value: '未上传' }],
              onFilter: (v, r) => r.deliverable_status === v,
              render: (v: DrilldownRow['deliverable_status']) => (
                v === '已上传'
                  ? <Tag color="green">已上传</Tag>
                  : <Tooltip title="未上传交付物，月末评分上限 95 分"><Tag color="red">未上传</Tag></Tooltip>
              ),
            },
            {
              title: '评分', dataIndex: 'score', width: 72, align: 'right',
              sorter: (a, b) => (a.score ?? 0) - (b.score ?? 0),
              render: (v?: number) => (typeof v === 'number' ? <span className="mono">{v}</span> : <span style={{ color: '#ccc' }}>—</span>),
            },
            {
              title: '操作', key: 'op', width: 66, fixed: 'right',
              render: (_, r: DrilldownRow) => (
                <Button type="link" size="small" onClick={() => onOpenItem(r)}>详情</Button>
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
}
