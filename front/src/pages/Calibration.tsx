import { Alert, Button, Card, Input, List, Modal, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { getCalibration, getPublishCheck, publishMonth, returnForBasis } from '@/services/api';
import { currentMonth } from '@/utils/rules';
import { toUserMessage } from '@/utils/error';
import { CONTRACT_STATUS_TEXT } from '@/types';
import type { CalibrationRow } from '@/types';

export default function Calibration() {
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<CalibrationRow[]>([]);
  const [checkRows, setCheckRows] = useState<Awaited<ReturnType<typeof getPublishCheck>>>([]);
  const [loading, setLoading] = useState(true);
  const [returnOpen, setReturnOpen] = useState<string | null>(null);
  const [opinion, setOpinion] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getCalibration(month));
      setCheckRows(await getPublishCheck(month).catch(() => []));
    } catch (e) {
      message.error(toUserMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const blocked = checkRows.filter((r) => r.issues.length > 0);

  const doReturn = async () => {
    if (!returnOpen) return;
    try {
      await returnForBasis(returnOpen, opinion);
      message.success('已退回组长补充依据');
      setReturnOpen(null);
      setOpinion('');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const doPublish = async () => {
    try {
      const res = await publishMonth(month);
      message.success(`已确认发布 ${res.published} 份合约`);
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} className="page-title">
          中心校准与发布
        </Typography.Title>
        <Space>
          <Input.Search placeholder="YYYY-MM" enterButton="切换" defaultValue={month} onSearch={(v) => setMonth(v || month)} style={{ width: 220 }} />
          <Popconfirm
            title="确认发布本月绩效？"
            description="发布前必须通过三项前置校验，发布后数据只读"
            onConfirm={() => void doPublish()}
            okButtonProps={{ disabled: blocked.length > 0 }}
          >
            <Button type="primary" disabled={blocked.length > 0}>
              确认发布
            </Button>
          </Popconfirm>
        </Space>
      </Space>

      <Alert
        type={blocked.length ? 'error' : 'success'}
        showIcon
        message={
          blocked.length
            ? `${blocked.length} 份合约不满足发布前置校验：①有效权重 100% ②合约与评分全确认 ③无录入异常`
            : '发布前置校验三项全部通过'
        }
        description={
          blocked.length ? (
            <List
              size="small"
              dataSource={blocked}
              renderItem={(r) => (
                <List.Item>
                  <Space>
                    <b>{r.user_name}</b>
                    {r.issues.map((x, k) => (
                      <Tag color="red" key={k}>
                        {x}
                      </Tag>
                    ))}
                    <Button type="link" size="small" onClick={() => setReturnOpen(r.contract_id)}>
                      退回补充依据
                    </Button>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            '可点击「确认发布」完成月度结果发布'
          )
        }
      />

      <Card size="small" loading={loading}>
        {rows.length === 0 && !loading ? (
          <EmptyState description="本月暂无成员合约" />
        ) : (
          <Table
            rowKey="contract_id"
            size="small"
            pagination={false}
            dataSource={rows}
            columns={[
              { title: '成员', dataIndex: 'user_name', width: 100 },
              { title: '状态', dataIndex: 'status', width: 120, render: (v: CalibrationRow['status']) => <Tag>{CONTRACT_STATUS_TEXT[v]}</Tag> },
              { title: '月度得分', dataIndex: 'score', width: 110, render: (v: number) => (v ? <b>{v}</b> : <span style={{ color: '#bbb' }}>未评分</span>) },
              { title: '与组均值偏差', dataIndex: 'deviation', width: 130, render: (v: number) => (Math.abs(v) >= 3 ? <Tag color="orange">{v > 0 ? '+' : ''}{v}</Tag> : <span>{v}</span>) },
              {
                title: '尺度提示',
                dataIndex: 'advice',
                render: (v: string | null) => (v ? <span style={{ color: '#d46b08' }}>{v}</span> : <span style={{ color: '#bbb' }}>正常</span>),
              },
              {
                title: '操作',
                key: 'op',
                width: 160,
                render: (_, r: CalibrationRow) => (
                  <Button type="link" size="small" onClick={() => setReturnOpen(r.contract_id)}>
                    退回补充依据
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Alert type="info" showIcon message="组内尺度提示（≥3 分偏差）不拦截发布，仅作校准参考（FR-09 R6）" />

      <Modal open={Boolean(returnOpen)} title="退回组长补充依据" okText="确认退回" onOk={() => void doReturn()} onCancel={() => setReturnOpen(null)}>
        <Input.TextArea rows={3} value={opinion} onChange={(e) => setOpinion(e.target.value)} placeholder="退回意见必填并留痕（FR-09 R7）" />
      </Modal>
    </Space>
  );
}
