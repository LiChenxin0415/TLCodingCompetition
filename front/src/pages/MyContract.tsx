import {
  Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Steps, Table, Tag,
  Tooltip, Typography, message,
} from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemTable from '@/components/ItemTable';
import AIConfirmBar from '@/components/AIConfirmBar';
import EmptyState from '@/components/EmptyState';
import {
  aiCheck, aiGenerateContract, aiParseProgress, confirmProgress, createContract, getMyContract,
  listObjectives, saveContract, submitContract, type MyContract as MyContractData,
} from '@/services/api';
import { toUserMessage, isDegradable, ApiError } from '@/utils/error';
import {
  sumWeight, itemCountValid, validateContract, dateInMonth, currentMonth, normalizeWeights,
} from '@/utils/rules';
import { CONTRACT_STATUS_TEXT, DELIVERABLE_TYPES, ITEM_TYPES, PRIORITIES } from '@/types';
import type { ContractItem, ItemCheck, Objective, ProgressParseResult } from '@/types';

const emptyItem = (contractId: string, objectiveId: string | null): ContractItem => ({
  id: '',
  contract_id: contractId,
  objective_id: objectiveId,
  type: '重点交付类',
  priority: '中',
  title: '',
  target_desc: '',
  deliverable_type: '其他',
  deliverable_desc: '',
  weight: 0,
  due_date: dateInMonth(currentMonth(), 25),
  progress: 0,
  source: 'manual',
  checked: 0,
});

/** Step 映射：合约状态机可视化（HLD §6.1） */
const STEP_MAP: Record<string, number> = {
  draft: 0,
  submitted: 1,
  rejected: 1,
  confirmed: 2,
  rated: 3,
  published: 4,
};

export default function MyContract() {
  const nav = useNavigate();
  const month = currentMonth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MyContractData | null>(null);
  const [items, setItems] = useState<ContractItem[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [checks, setChecks] = useState<Record<string, ItemCheck>>({});
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);

  const [genOpen, setGenOpen] = useState(false);
  const [genDesc, setGenDesc] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<ContractItem[]>([]);
  const [genTarget, setGenTarget] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ContractItem | null>(null);
  const [form] = Form.useForm<ContractItem>();

  const [ptext, setPtext] = useState('');
  const [pItem, setPItem] = useState<string | undefined>();
  const [parse, setParse] = useState<ProgressParseResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const readonly = data?.contract?.status === 'published';
  const totalWeight = useMemo(() => sumWeight(items), [items]);

  const load = async () => {
    setLoading(true);
    try {
      const [res, objs] = await Promise.all([getMyContract(month), listObjectives()]);
      setData(res);
      setItems(res.items);
      setObjectives(objs);
    } catch (e) {
      message.error(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const recalcChecks = async (list: ContractItem[]) => {
    try {
      const res = await aiCheck(list);
      const map: Record<string, ItemCheck> = {};
      // 体检结果按标题回填（AI 返回逐条）
      list.forEach((it, idx) => {
        const c = res[idx];
        if (c) map[it.id || it.title] = c;
      });
      setChecks(map);
    } catch (e) {
      if (!isDegradable(e)) message.warning(toUserMessage(e));
    }
  };

  const handleCreate = async () => {
    try {
      await createContract(month);
      message.success(`已创建 ${month} 合约草稿`);
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const res = await aiGenerateContract(genDesc, genTarget ?? undefined);
      const weights = normalizeWeights(res.items);
      const list: ContractItem[] = res.items.map((raw, idx) => ({
        id: '',
        contract_id: data?.contract?.id ?? '',
        objective_id: (raw.objective_id as string | null) ?? null,
        type: raw.type,
        priority: raw.priority,
        title: raw.title,
        target_desc: raw.target_desc,
        deliverable_type: raw.deliverable_type,
        deliverable_desc: raw.deliverable_desc,
        weight: weights[idx],
        due_date: raw.due_date,
        progress: 0,
        source: 'AI',
        checked: 0,
      }));
      setGenResult(list);
      message.success(`AI 生成 ${list.length} 个工作包，权重已归一化到 100%`);
    } catch (e) {
      // AI 不可用 → 降级为模板预填 + 手工新增（PRD §11）
      setManualMode(true);
      message.warning(isDegradable(e) ? 'AI 暂不可用，已切换为手工新增模板' : toUserMessage(e));
      setGenResult([
        { ...emptyItem(data?.contract?.id ?? '', objectives[0]?.id ?? null), title: '本月重点工作', target_desc: '完成 xx 项，耗时下降 xx%' },
      ]);
    } finally {
      setGenLoading(false);
    }
  };

  const applyGenerated = async () => {
    const merged = [...items, ...genResult.filter((i) => i.title)];
    await persist(merged);
    setGenOpen(false);
    setGenResult([]);
    setGenDesc('');
  };

  const persist = async (list: ContractItem[]) => {
    if (!data?.contract) return;
    try {
      const res = await saveContract(data.contract.id, list);
      setItems(res.items);
      const v = validateContract(res.items);
      setIssues(v);
      await recalcChecks(res.items);
      message.success('已保存');
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const openEdit = (item: ContractItem) => {
    setEditing(item);
    form.setFieldsValue(item);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    const values = await form.validateFields();
    const next = items.some((i) => i.id === editing?.id && i.id)
      ? items.map((i) => (i.id === editing?.id ? { ...i, ...values } : i))
      : [...items, { ...emptyItem(data?.contract?.id ?? '', null), ...values, id: '' }];
    setItems(next);
    setEditOpen(false);
    await persist(next);
  };

  const handleDelete = async (item: ContractItem) => {
    const next = items.filter((i) => i.id !== item.id);
    setItems(next);
    if (item.id) await persist(next);
  };

  const handleSubmit = async () => {
    if (!data?.contract) return;
    const v = validateContract(items);
    setIssues(v);
    if (v.length) {
      message.error(v.map((i) => i.message).join('；'));
      return;
    }
    try {
      await submitContract(data.contract.id);
      message.success('已提交，等待组长核对');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const handleParse = async () => {
    try {
      const res = await aiParseProgress(ptext, pItem);
      setParse(res);
      if (res.no_signal) message.warning('未识别到明确进展');
    } catch (e) {
      if (isDegradable(e)) {
        message.warning('AI 暂不可用，请手动更新进度');
        setManualMode(true);
        setParse(null);
      } else if (e instanceof ApiError) {
        message.warning(e.message); // 如本月无在办工作包（422）
      } else {
        message.error(toUserMessage(e));
      }
    }
  };

  const applyProgress = async (payload: { item_id: string; new_progress: number; delta: number }, raw_text: string) => {
    const target = items.find((i) => i.id === payload.item_id);
    const oldProgress = target?.progress ?? 0;
    const delta = payload.new_progress - oldProgress;
    // 回退 >20% 需原因（FR-01 R4）——此处简化：回退时弹提示由服务端 422 兜底，前端给出确认
    try {
      await confirmProgress({
        item_id: payload.item_id,
        new_progress: payload.new_progress,
        raw_text,
        delta,
        evidence: parse?.evidence ?? '',
        confidence: parse?.confidence ?? 1,
      });
      message.success('进度已更新并留痕');
      setParse(null);
      setPtext('');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  if (loading) return <Card loading />;

  const checkOf = (it: ContractItem) => checks[it.id || it.title];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Title level={4} className="page-title">
        {month} 我的合约
        {data?.contract && <Tag style={{ marginLeft: 8 }}>{CONTRACT_STATUS_TEXT[data.contract.status]}</Tag>}
      </Typography.Title>

      {data?.contract && (
        <Card size="small">
          <Steps
            size="small"
            current={STEP_MAP[data.contract.status] ?? 0}
            status={data.contract.status === 'rejected' ? 'error' : undefined}
            items={[
              { title: '草稿' },
              { title: '组长核对' },
              { title: '执行中' },
              { title: '月末评分' },
              { title: '已发布' },
            ]}
          />
          {data.contract.status === 'rejected' && (
            <Alert type="error" showIcon message={`已退回：${data.contract.reject_reason || '未提供退回意见'}`} style={{ marginTop: 12 }} />
          )}
        </Card>
      )}

      {!data?.contract ? (
        <EmptyState
          description="本月暂无合约"
          extra={
            <Space>
              <Button type="primary" onClick={handleCreate}>
                创建合约
              </Button>
              <Button icon={<BulbOutlined />} onClick={() => { void handleCreate(); setGenOpen(true); }}>
                AI 生成
              </Button>
            </Space>
          }
        />
      ) : (
        <>
          {/* FR-01 自然语言进度更新 */}
          <Card title="说一句更新进度" size="small">
            <Space.Compact style={{ width: '100%' }}>
              <Select
                allowClear
                style={{ width: 220 }}
                placeholder="指定工作包（可选）"
                value={pItem}
                onChange={(v) => setPItem(v)}
                options={items.map((i) => ({ value: i.id, label: i.title }))}
              />
              <Input
                placeholder="例：今天联调全部完成，环境问题已解决"
                value={ptext}
                maxLength={500}
                onChange={(e) => setPtext(e.target.value)}
              />
              <Button type="primary" onClick={handleParse} disabled={!ptext.trim()}>
                AI 解析
              </Button>
            </Space.Compact>
            {parse && (
              <div style={{ marginTop: 12 }}>
                <AIConfirmBar
                  result={parse}
                  rawText={ptext}
                  onAdopt={(p) => void applyProgress(p, ptext)}
                  onReject={() => setParse(null)}
                />
              </div>
            )}
            {manualMode && (
              <Alert type="warning" showIcon message="AI 降级：请到工作包详情页手工录入进度" style={{ marginTop: 12 }} />
            )}
          </Card>

          {/* FR-02 合约编辑 */}
          <Card
            title="工作包（3–5 个，权重合计 100%）"
            size="small"
            extra={
              <Space>
                <Tooltip title={!itemCountValid(items) ? '工作包数量须为 3–5 个' : totalWeight !== 100 ? `权重合计 ${totalWeight}% ≠ 100%` : '校验通过'}>
                  <Tag color={totalWeight === 100 ? 'green' : 'red'}>
                    权重合计 {totalWeight}%
                  </Tag>
                </Tooltip>
                {!readonly && (
                  <>
                    <Button icon={<BulbOutlined />} onClick={() => setGenOpen(true)}>
                      AI 生成
                    </Button>
                    <Button onClick={() => { setEditing(null); form.resetFields(); setEditOpen(true); }}>
                      新增工作包
                    </Button>
                    <Button type="primary" onClick={handleSubmit} disabled={totalWeight !== 100 || readonly}>
                      提交核对
                    </Button>
                  </>
                )}
              </Space>
            }
          >
            {issues.length > 0 && (
              <Alert
                type={issues.some((i) => i.field === 'weight') ? 'error' : 'warning'}
                showIcon
                style={{ marginBottom: 12 }}
                message="提交前需修正"
                description={<ul style={{ margin: 0, paddingLeft: 18 }}>{issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
              />
            )}

            <ItemTable
              items={items}
              deliverables={data.deliverables}
              objectives={objectives.map((o) => ({ id: o.id, name: o.name }))}
              readonly={readonly}
              onRowClick={(it) => nav(`/items/${it.id}`)}
            />

            {items.length > 0 && (
              <Table
                size="small"
                style={{ marginTop: 12 }}
                pagination={false}
                rowKey={(r: ContractItem) => r.id || r.title}
                dataSource={items}
                scroll={{ x: 900 }}
                columns={[
                  { title: '工作包', dataIndex: 'title', width: 200, ellipsis: true },
                  {
                    title: '体检分',
                    key: 'check',
                    width: 260,
                    render: (_: unknown, r: ContractItem) => {
                      const c = checkOf(r);
                      if (!c) return <span style={{ color: '#bbb' }}>—</span>;
                      return (
                        <Space size={4} wrap>
                          <Tag color={c.score >= 90 ? 'green' : c.score >= 80 ? 'orange' : 'red'}>{c.score} 分</Tag>
                          {c.issues.map((x, k) => (
                            <Tag key={k} color="volcano">
                              {x}
                            </Tag>
                          ))}
                        </Space>
                      );
                    },
                  },
                  {
                    title: '操作',
                    key: 'op',
                    width: 140,
                    render: (_: unknown, r: ContractItem) => (
                      <Space size={4}>
                        {!readonly && (
                          <>
                            <Button type="link" size="small" onClick={() => openEdit(r)}>
                              编辑
                            </Button>
                            <Popconfirm title="确认删除该工作包？" onConfirm={() => void handleDelete(r)}>
                              <Button type="link" size="small" danger>
                                删除
                              </Button>
                            </Popconfirm>
                          </>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </>
      )}

      {/* AI 生成 */}
      <Modal
        open={genOpen}
        title="AI 生成月度合约"
        okText="采纳并填入"
        confirmLoading={genLoading}
        onOk={() => void (genResult.length ? applyGenerated() : handleGenerate())}
        onCancel={() => { setGenOpen(false); setGenResult([]); }}
        width={860}
      >
        {!genResult.length ? (
          <>
            <Space.Compact style={{ width: '100%' }}>
              <Input.TextArea
                rows={3}
                value={genDesc}
                maxLength={500}
                onChange={(e) => setGenDesc(e.target.value)}
                placeholder="例：这个月主要搞慢SQL治理和AB需求，再保证生产稳定"
              />
            </Space.Compact>
            <Select
              style={{ width: '100%', marginTop: 12 }}
              allowClear
              placeholder="关联大目标（可选）"
              value={genTarget}
              onChange={(v) => setGenTarget(v)}
              options={objectives.map((o) => ({ value: o.id, label: o.name }))}
            />
            <Alert type="info" showIcon style={{ marginTop: 12 }} message="AI 生成结果必须可编辑，生成的工作包标记为 AI 来源便于统计采纳率（FR-02 R5）" />
          </>
        ) : (
          <Table
            size="small"
            rowKey={(r: ContractItem) => r.title}
            pagination={false}
            dataSource={genResult}
            columns={[
              { title: '类型', dataIndex: 'type', width: 110 },
              { title: '工作包', dataIndex: 'title', width: 160 },
              { title: '本月目标', dataIndex: 'target_desc', ellipsis: true },
              { title: '交付物', key: 'deliverable_type', width: 140, render: (_: unknown, r: ContractItem) => `${r.deliverable_type}` },
              { title: '权重', dataIndex: 'weight', width: 80, align: 'right', render: (v: number) => `${v}%` },
              { title: '截止日', dataIndex: 'due_date', width: 110 },
            ]}
          />
        )}
      </Modal>

      {/* 工作包编辑 */}
      <Modal open={editOpen} title={editing ? '编辑工作包' : '新增工作包'} onOk={() => void submitEdit()} onCancel={() => setEditOpen(false)} width={720}>
        <Form form={form} layout="vertical" size="middle">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="title" label="工作包标题" rules={[{ required: true, message: '标题必填' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="type" label="任务类型" rules={[{ required: true }]}>
                <Select options={ITEM_TYPES.map((t) => ({ value: t, label: t }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                <Select options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="target_desc" label="本月目标（需含数字 + 可验证动词）" rules={[{ required: true }]}>
            <Input.TextArea rows={2} maxLength={200} showCount />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="deliverable_type" label="交付物类型" rules={[{ required: true }]}>
                <Select options={DELIVERABLE_TYPES.map((d) => ({ value: d, label: d }))} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="deliverable_desc" label="交付物说明" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="weight" label="权重(%)" rules={[{ required: true }]}>
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="due_date" label="计划截止日" rules={[{ required: true }]}>
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="objective_id" label="关联大目标（基础履职类可空）">
                <Select allowClear options={objectives.map((o) => ({ value: o.id, label: o.name }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
}
