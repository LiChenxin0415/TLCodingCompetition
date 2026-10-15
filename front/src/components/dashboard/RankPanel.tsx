import { Card, Empty, Radio, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import ProgressBar from '@/components/ProgressBar';
import { CONTRACT_STATUS_TEXT } from '@/types';
import type { ContractStatus, GroupStat, PersonStat } from '@/types';

interface Props {
  groups: GroupStat[];
  persons: PersonStat[];
  loading: boolean;
  /** 组长视角强制只看本组 */
  lockGroup?: boolean;
  onPickPerson: (userId: string) => void;
}

/** 组 / 个人排行面板：同维度对比平均进度与履约得分，支持切换到个人级下钻 */
export default function RankPanel({ groups, persons, loading, lockGroup, onPickPerson }: Props) {
  const [view, setView] = useState<'group' | 'person'>('group');

  const scoreColor = (s: number) => (s >= 110 ? '#52c41a' : s >= 100 ? '#1677ff' : s >= 90 ? '#fa8c16' : '#cf1322');

  return (
    <Card
      size="small"
      className="dash-card"
      loading={loading}
      title="推进排行"
      extra={
        <Radio.Group size="small" value={view} onChange={(e) => setView(e.target.value)}>
          <Radio.Button value="group">按组</Radio.Button>
          <Radio.Button value="person">按人</Radio.Button>
        </Radio.Group>
      }
    >
      {view === 'group' ? (
        <Table
          size="small"
          rowKey="group_id"
          pagination={false}
          dataSource={groups}
          locale={{ emptyText: <Empty description="当前范围暂无组数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          columns={[
            {
              title: '排名', key: 'rk', width: 56,
              render: (_, __, idx) => (
                <Tag color={idx === 0 ? 'gold' : idx === 1 ? 'blue' : 'default'}>{idx + 1}</Tag>
              ),
            },
            { title: '组', dataIndex: 'group_name', width: 80 },
            { title: '人数', dataIndex: 'member_count', width: 60, align: 'right' },
            { title: '合约', dataIndex: 'contract_count', width: 60, align: 'right' },
            { title: '工作包', dataIndex: 'item_count', width: 70, align: 'right' },
            {
              title: '平均进度', dataIndex: 'avg_progress', width: 150,
              render: (v: number) => <ProgressBar value={v} height={8} showText />,
              sorter: (a, b) => a.avg_progress - b.avg_progress,
              defaultSortOrder: 'descend',
            },
            {
              title: '平均得分', dataIndex: 'avg_score', width: 90, align: 'right',
              render: (v: number) => (v ? <span className="mono" style={{ color: scoreColor(v) }}>{v}</span> : <span style={{ color: '#ccc' }}>—</span>),
            },
            {
              title: '风险', dataIndex: 'risk_count', width: 60, align: 'right',
              render: (v: number) => (v ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag>),
            },
            {
              title: '已发布', dataIndex: 'published_count', width: 70, align: 'right',
              render: (v: number, r: GroupStat) => <span className="mono">{v}/{r.contract_count}</span>,
            },
          ]}
        />
      ) : (
        <Table
          size="small"
          rowKey="user_id"
          pagination={false}
          scroll={{ x: 720 }}
          dataSource={persons}
          locale={{ emptyText: <Empty description="当前范围暂无成员合约" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          onRow={(r) => ({ className: 'clickable-row', onClick: () => onPickPerson(r.user_id) })}
          columns={[
            {
              title: '排名', key: 'rk', width: 56,
              render: (_, __, idx) => (
                <Tag color={idx === 0 ? 'gold' : idx === 1 ? 'blue' : 'default'}>{idx + 1}</Tag>
              ),
            },
            {
              title: '成员', dataIndex: 'user_name', width: 80,
              render: (v: string, r: PersonStat) => (
                <Tooltip title="点击按该成员下钻">
                  <Typography.Text strong style={{ color: '#1677ff' }}>{v}</Typography.Text>
                  <div style={{ color: '#bbb', fontSize: 11, fontWeight: 400 }}>{r.group_name}</div>
                </Tooltip>
              ),
            },
            {
              title: '合约状态', dataIndex: 'contract_status', width: 100,
              render: (v: ContractStatus | null) =>
                v ? <Tag>{CONTRACT_STATUS_TEXT[v]}</Tag> : <Tag color="default">无合约</Tag>,
            },
            { title: '工作包', dataIndex: 'item_count', width: 70, align: 'right' },
            {
              title: '平均进度', dataIndex: 'avg_progress', width: 150,
              sorter: (a, b) => a.avg_progress - b.avg_progress,
              defaultSortOrder: 'descend',
              render: (v: number) => <ProgressBar value={v} height={8} showText />,
            },
            {
              title: '月度得分', dataIndex: 'score', width: 90, align: 'right',
              sorter: (a, b) => (a.score ?? 0) - (b.score ?? 0),
              render: (v: number | null) =>
                v ? <span className="mono" style={{ color: scoreColor(v), fontWeight: 600 }}>{v}</span> : <span style={{ color: '#ccc' }}>未评分</span>,
            },
            {
              title: '风险', dataIndex: 'risk_count', width: 60, align: 'right',
              render: (v: number) => (v ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag>),
            },
            {
              title: '缺交付物', dataIndex: 'undelivered_count', width: 90, align: 'right',
              render: (v: number) =>
                v ? (
                  <Tooltip title="缺交付物的工作包月末评分上限 95 分（FR-03 R4）">
                    <Tag color="orange">{v}</Tag>
                  </Tooltip>
                ) : (
                  <Tag color="green">齐全</Tag>
                ),
            },
          ]}
        />
      )}
      {!lockGroup && view === 'person' && (
        <Space style={{ marginTop: 8 }}>
          <span style={{ color: '#bbb', fontSize: 11 }}>点击任意成员行 → 按该成员下钻；组长视角仅可见本组成员（FR-05 R4）</span>
        </Space>
      )}
    </Card>
  );
}
