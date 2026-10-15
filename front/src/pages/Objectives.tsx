import { Button, Card, Col, Drawer, Form, Input, Progress, Row, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { getObjective, listObjectives, saveObjective } from '@/services/api';
import { useAuth } from '@/store/auth';
import { toUserMessage } from '@/utils/error';
import { objectiveProgress } from '@/utils/rules';
import { db } from '@/services/seed';
import type { Objective } from '@/types';

const STATUS_OPTIONS = ['进行中', '已达成', '已关闭'];

interface DetailRow {
  item_id: string;
  user_name: string;
  month: string;
  title: string;
  weight: number;
  progress: number;
  contribution: number;
  deliverable_status: string;
}

export default function Objectives() {
  const { user } = useAuth();
  const [list, setList] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Objective | null>(null);
  const [form] = Form.useForm<Objective>();
  const [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [detailObj, setDetailObj] = useState<Objective | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setList(await listObjectives());
    } catch (e) {
      message.error(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openDetail = async (id: string) => {
    try {
      const res = await getObjective(id);
      setDetailObj(res.objective);
      setRows(res.rows as unknown as DetailRow[]);
      setDetailOpen(id);
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const submit = async () => {
    const values = await form.validateFields();
    try {
      await saveObjective(values as unknown as Record<string, unknown>, editing?.id);
      message.success('已保存');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const canEdit = user?.role === 'center' || user?.role === 'leader';

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} className="page-title">
          大目标（发布包）
        </Typography.Title>
        {canEdit && (
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            新建大目标
          </Button>
        )}
      </Space>

      <Card size="small" loading={loading}>
        {list.length === 0 && !loading ? (
          <EmptyState description="暂无大目标，请联系中心管理者创建" />
        ) : (
          <Row gutter={[12, 12]}>
            {list.map((o) => (
              <Col xs={24} md={12} key={o.id}>
                <Card
                  size="small"
                  title={o.name}
                  extra={<Tag color={o.status === '进行中' ? 'blue' : o.status === '已达成' ? 'green' : 'default'}>{o.status}</Tag>}
                  actions={[
                    <Button key="detail" type="link" onClick={() => void openDetail(o.id)}>
                      查看详情
                    </Button>,
                    ...(canEdit
                      ? [
                          <Button
                            key="edit"
                            type="link"
                            onClick={() => {
                              setEditing(o);
                              form.setFieldsValue(o);
                              setOpen(true);
                            }}
                          >
                            编辑
                          </Button>,
                        ]
                      : []),
                  ]}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ color: '#888', fontSize: 12 }}>
                      负责人：{db.users.find((u) => u.id === o.owner_id)?.name ?? '—'} ｜ {o.start_date} ~ {o.end_date}
                    </div>
                    <Progress percent={objectiveProgress([]) === 0 ? o.progress : o.progress} size="small" strokeColor={o.progress >= 80 ? '#52c41a' : '#1677ff'} />
                    <Typography.Text type="secondary">加权进度 {o.progress}%</Typography.Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Drawer
        open={Boolean(detailOpen)}
        title={`${detailObj?.name ?? ''} · 关联合约包`}
        width={960}
        onClose={() => setDetailOpen(null)}
      >
        <Typography.Paragraph type="secondary">
          加权进度 = {detailObj?.progress}% ｜ 计算公式：Σ(工作包进度 × 权重) ÷ Σ(权重)，保留 1 位小数（FR-04 R3）
        </Typography.Paragraph>
        {rows.length === 0 ? (
          <EmptyState description="当前无合约包关联" />
        ) : (
          <Table
            rowKey="item_id"
            size="small"
            pagination={false}
            dataSource={rows}
            columns={[
              { title: '成员', dataIndex: 'user_name', width: 90 },
              { title: '月份', dataIndex: 'month', width: 100 },
              { title: '工作包', dataIndex: 'title', width: 200 },
              { title: '权重', dataIndex: 'weight', width: 80, align: 'right', render: (v: number) => `${v}%` },
              { title: '进度', dataIndex: 'progress', width: 160, render: (v: number) => <Progress percent={v} size="small" /> },
              { title: '贡献占比', dataIndex: 'contribution', width: 100, render: (v: number) => `${v}%` },
              {
                title: '交付物',
                dataIndex: 'deliverable_status',
                width: 100,
                render: (v: string) => <Tag color={v === '已上传' ? 'green' : 'red'}>{v}</Tag>,
              },
            ]}
          />
        )}
      </Drawer>

      <ModalForm open={open} form={form} editing={editing} onOk={() => void submit()} onCancel={() => setOpen(false)} />
    </Space>
  );
}

/** 受 Form 控制的抽屉表单（独立组件，避免主页面状态污染） */
function ModalForm({
  open, editing, form, onOk, onCancel,
}: {
  open: boolean;
  editing: Objective | null;
  form: ReturnType<typeof Form.useForm<Objective>>[0];
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <Drawer open={open} title={editing ? '编辑大目标' : '新建大目标'} width={480} onClose={onCancel} footer={
      <Space>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={onOk}>
          保存
        </Button>
      </Space>
    }>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="group_id" label="所属中心/组" rules={[{ required: true }]} initialValue="grp_a">
          <Input placeholder="grp_a" />
        </Form.Item>
        <Form.Item name="owner_id" label="负责人账号" rules={[{ required: true }]} initialValue="leader01">
          <Input placeholder="leader01" />
        </Form.Item>
        <Form.Item name="start_date" label="开始日期" rules={[{ required: true }]} initialValue="2026-10-01">
          <Input placeholder="YYYY-MM-DD" />
        </Form.Item>
        <Form.Item name="end_date" label="结束日期" rules={[{ required: true }]} initialValue="2026-12-31">
          <Input placeholder="YYYY-MM-DD" />
        </Form.Item>
        <Form.Item name="status" label="状态" initialValue="进行中">
          <Input placeholder={STATUS_OPTIONS.join(' / ')} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
