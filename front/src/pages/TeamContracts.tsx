import { Alert, Button, Card, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import ItemTable from '@/components/ItemTable';
import EmptyState from '@/components/EmptyState';
import ScoreInput from '@/components/ScoreInput';
import {
  confirmContract, exportLedger, getTeamContracts, listObjectives, rejectContract, scoreItem, submitRating,
} from '@/services/api';
import { CAP_NO_DELIVERABLE, currentMonth, monthlyScore } from '@/utils/rules';
import { downloadText } from '@/utils/file';
import { CONTRACT_STATUS_TEXT } from '@/types';
import { toUserMessage } from '@/utils/error';

type Row = Awaited<ReturnType<typeof getTeamContracts>>[number];

export default function TeamContracts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [objectives, setObjectives] = useState<{ id: string; name: string }[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [scoreOpen, setScoreOpen] = useState<{ row: Row; itemId: string } | null>(null);
  const [scoreVal, setScoreVal] = useState<{ score?: number; basis: string; force_reason?: string }>({ basis: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTeamContracts(month);
      setRows(res);
    } catch (e) {
      message.error(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void listObjectives().then((o) => setObjectives(o.map((x) => ({ id: x.id, name: x.name }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const doConfirm = async (contractId: string) => {
    try {
      await confirmContract(contractId);
      message.success('已确认合约');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const doReject = async () => {
    if (!rejectOpen) return;
    try {
      await rejectContract(rejectOpen, rejectReason);
      message.success('已退回');
      setRejectOpen(null);
      setRejectReason('');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const doScore = async () => {
    if (!scoreOpen || scoreVal.score === undefined) return;
    try {
      await scoreItem({ item_id: scoreOpen.itemId, score: scoreVal.score, basis: scoreVal.basis, force_reason: scoreVal.force_reason });
      message.success('评分已保存');
      setScoreOpen(null);
      setScoreVal({ basis: '' });
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const doSubmitRating = async (contractId: string) => {
    try {
      const c = await submitRating(contractId);
      message.success(`评分已提交，月度得分 ${c.score}`);
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const doExport = async () => {
    try {
      const csv = await exportLedger(month);
      downloadText(`月度台账_${month}.csv`, csv, 'text/csv;charset=utf-8');
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const columns = [
    { title: '成员', dataIndex: ['user', 'name'], key: 'user' },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: unknown, r: Row) => (r.contract ? <Tag>{CONTRACT_STATUS_TEXT[r.contract.status]}</Tag> : <Tag color="red">无合约</Tag>),
    },
    {
      title: '工作包',
      key: 'count',
      width: 80,
      render: (_: unknown, r: Row) => r.items.length,
    },
    {
      title: '权重合计',
      key: 'weight',
      width: 100,
      render: (_: unknown, r: Row) => {
        const total = r.items.reduce((s, i) => s + i.weight, 0);
        return <Tag color={total === 100 ? 'green' : 'red'}>{total}%</Tag>;
      },
    },
    {
      title: '月度得分',
      key: 'score',
      width: 110,
      render: (_: unknown, r: Row) => (r.contract?.score ? <b>{r.contract.score}</b> : <span style={{ color: '#bbb' }}>—</span>),
    },
    {
      title: '操作',
      key: 'op',
      width: 260,
      render: (_: unknown, r: Row) => {
        if (!r.contract) return <span style={{ color: '#bbb' }}>本月暂无合约</span>;
        const unscoredCount = r.items.filter((i) => typeof i.score !== 'number').length;
        return (
          <Space size={4}>
            {r.contract.status === 'submitted' && (
              <>
                <Button type="link" size="small" onClick={() => void doConfirm(r.contract!.id)}>
                  确认
                </Button>
                <Button type="link" size="small" danger onClick={() => setRejectOpen(r.contract!.id)}>
                  退回
                </Button>
              </>
            )}
            {(r.contract.status === 'confirmed' || r.contract.status === 'rated') && (
              <Button type="link" size="small" disabled={unscoredCount > 0} onClick={() => void doSubmitRating(r.contract!.id)}>
                提交评分（剩 {unscoredCount} 项未评）
              </Button>
            )}
            {r.contract.status === 'published' && <span style={{ color: '#bbb' }}>已发布只读</span>}
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} className="page-title">
          组内合约核对与评分
        </Typography.Title>
        <Space>
          <Input.Search placeholder="月份 YYYY-MM" enterButton="切换" defaultValue={month} onSearch={(v) => setMonth(v || month)} style={{ width: 240 }} />
          <Button icon={<DownloadOutlined />} onClick={() => void doExport()}>
            导出台账
          </Button>
        </Space>
      </Space>

      <Alert type="info" showIcon message="评分规则：80–120 分；偏离 100 分必须填写依据；未上传交付物的工作包最高 95 分（FR-09 R1/R4）" />

      <Card size="small" loading={loading}>
        {rows.length === 0 && !loading ? (
          <EmptyState description="本组暂无成员合约" />
        ) : (
          <Table
            rowKey={(r: Row) => r.user.id}
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={false}
            expandable={{
              expandedRowRender: (r: Row) =>
                r.items.length ? (
                  <ItemTable
                    items={r.items}
                    deliverables={r.deliverables}
                    objectives={objectives}
                    readonly={r.contract?.status === 'published'}
                    onScore={(it) => setScoreOpen({ row: r, itemId: it.id })}
                    onRowClick={(it) => window.open(`/items/${it.id}`, '_blank')}
                  />
                ) : (
                  <EmptyState description="该成员本月无工作包" />
                ),
              rowExpandable: (r: Row) => r.items.length > 0,
            }}
          />
        )}
      </Card>

      <Modal open={Boolean(rejectOpen)} title="退回合约" okText="确认退回" onOk={() => void doReject()} onCancel={() => setRejectOpen(null)}>
        <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="退回意见必填并留痕（HLD §6.1）" />
      </Modal>

      <Modal open={Boolean(scoreOpen)} title="评分" okText="保存评分" onOk={() => void doScore()} onCancel={() => setScoreOpen(null)}>
        {scoreOpen && (
          <>
            <div className="section-label">
              {scoreOpen.row.items.find((i) => i.id === scoreOpen.itemId)?.title}
              {' ｜ '}
              {scoreOpen.row.user.name}
            </div>
            <ScoreInput
              hasDeliverable={(scoreOpen.row.deliverables[scoreOpen.itemId] ?? []).length > 0}
              onChange={(score, basis, force_reason) => setScoreVal({ score, basis, force_reason })}
            />
            <Alert
              type={scoreVal.score === undefined ? 'info' : scoreVal.score !== 100 && !scoreVal.basis ? 'error' : 'success'}
              style={{ marginTop: 12 }}
              showIcon
              message={
                scoreVal.score === undefined
                  ? '提示：满分 100 = 完整履约；>100 需存在可验证的超预期成果'
                  : scoreVal.score !== 100 && !scoreVal.basis
                    ? '偏离 100 分须说明依据'
                    : `预计保存 ${scoreVal.score} 分${scoreVal.force_reason ? '（强制，已填理由）' : ''}`
              }
              description={`未上传交付物的工作包上限为 ${CAP_NO_DELIVERABLE} 分`}
            />
          </>
        )}
      </Modal>
      <Typography.Text type="secondary">
        数据日期：{dayjs().format('YYYY-MM-DD')} ｜ 月度得分 = Σ(工作包评分 × 权重) ÷ 100，示例 {monthlyScore([{ score: 100, weight: 100 }])}
      </Typography.Text>
    </Space>
  );
}
