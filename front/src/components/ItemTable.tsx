import { Button, Progress, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ContractItem, Deliverable } from '@/types';
import { riskStatus, scoreTier } from '@/utils/rules';
import RiskTag from './RiskTag';

interface Props {
  items: ContractItem[];
  deliverables?: Record<string, Deliverable[]>;
  objectives?: { id: string; name: string }[];
  readonly?: boolean;
  showOwner?: boolean;
  ownerName?: string;
  onRowClick?: (item: ContractItem) => void;
  onUpload?: (item: ContractItem) => void;
  /** 组长评分入口 */
  onScore?: (item: ContractItem) => void;
}

/** 工作包表格（FR-05 R2 固定列：成员/工作包/类型/大目标/权重/进度/截止日/风险/交付物） */
export default function ItemTable({
  items,
  deliverables = {},
  objectives = [],
  readonly = false,
  showOwner = false,
  ownerName,
  onRowClick,
  onUpload,
  onScore,
}: Props) {
  const objName = (id: string | null) => objectives.find((o) => o.id === id)?.name ?? '—';

  const columns: ColumnsType<ContractItem> = [
    ...(showOwner
      ? [{ title: '成员', dataIndex: 'owner', key: 'owner', width: 90, render: () => ownerName ?? '' }]
      : []),
    {
      title: '工作包',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (v: string, r) => (
        <Space size={4}>
          <Tooltip title={r.target_desc}>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </Tooltip>
          {r.source === 'AI' && (
            <Tag className="ai-badge" style={{ marginInlineEnd: 0 }}>
              AI
            </Tag>
          )}
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80 },
    {
      title: '大目标',
      dataIndex: 'objective_id',
      key: 'objective_id',
      width: 180,
      ellipsis: true,
      render: (v: string | null) => objName(v),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 80,
      align: 'right',
      render: (v: number) => `${v}%`,
    },
    {
      title: '本月目标',
      dataIndex: 'target_desc',
      key: 'target_desc',
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ color: '#555' }}>{v}</span>
        </Tooltip>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (v: number) => <Progress percent={v} size="small" status={v >= 100 ? 'success' : undefined} />,
    },
    { title: '截止日', dataIndex: 'due_date', key: 'due_date', width: 110 },
    {
      title: '风险',
      key: 'risk',
      width: 80,
      render: (_, r) => <RiskTag status={riskStatus(r)} />,
    },
    {
      title: '交付物',
      key: 'deliverable',
      width: 130,
      render: (_, r) => {
        const list = deliverables[r.id] ?? [];
        const ok = list.length > 0;
        return ok ? (
          <Tag color="green">{`已上传 ${list.length}`}</Tag>
        ) : (
          <Space size={4}>
            <Tag color="red">未上传</Tag>
            {!readonly && onUpload && (
              <Button type="link" size="small" onClick={() => onUpload(r)}>
                上传
              </Button>
            )}
          </Space>
        );
      },
    },
    {
      title: '评分',
      key: 'score',
      width: 110,
      render: (_, r) =>
        typeof r.score === 'number' ? (
          <Tooltip title={r.score_basis || '无评分说明'}>
            <Tag color={r.score >= 100 ? 'blue' : 'orange'}>
              {r.score} · {scoreTier(r.score)}
            </Tag>
          </Tooltip>
        ) : (
          <span style={{ color: '#bbb' }}>未评分</span>
        ),
    },
    ...(readonly
      ? []
      : [
          {
            title: '操作',
            key: 'action',
            width: 160,
            render: (_: unknown, r: ContractItem) => (
              <Space size={4}>
                {onRowClick && (
                  <Button type="link" size="small" onClick={() => onRowClick(r)}>
                    详情
                  </Button>
                )}
                {onScore && !readonly && (
                  <Button type="link" size="small" onClick={() => onScore(r)}>
                    评分
                  </Button>
                )}
              </Space>
            ),
          } as ColumnsType<ContractItem>[number],
        ]),
  ];

  return (
    <Table
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={items}
      pagination={false}
      scroll={{ x: 1400 }}
      rowClassName={() => (onRowClick ? 'clickable-row' : '')}
      onRow={(record: ContractItem) => (onRowClick ? { onClick: () => onRowClick(record) } : {})}
    />
  );
}
