import {
  Alert, Button, Card, Col, Descriptions, Input, List, Modal, Progress, Row, Select, Space, Tag, Timeline, Tooltip,
  Typography, Upload, message,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AIConfirmBar from '@/components/AIConfirmBar';
import {
  addDeliverable, aiParseProgress, confirmProgress, deleteDeliverable, getItemDetail, listObjectives, manualProgress,
  updateItem,
} from '@/services/api';
import { CHANGE_REASONS, CONTRACT_STATUS_TEXT } from '@/types';
import type { ChangeReason } from '@/types';
import { isDegradable, toUserMessage } from '@/utils/error';
import { checkItem, currentMonth } from '@/utils/rules';

const WHITELIST = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'zip', 'md', 'txt'];
const MAX_MB = 50; // 交付物 ≤50MB（日报周报 20MB，见 Reports）

interface Detail {
  item: NonNullable<Awaited<ReturnType<typeof getItemDetail>>>['item'];
  contract: NonNullable<Awaited<ReturnType<typeof getItemDetail>>>['contract'];
  owner: NonNullable<Awaited<ReturnType<typeof getItemDetail>>>['owner'];
  objective: { name: string } | null;
  deliverables: NonNullable<Awaited<ReturnType<typeof getItemDetail>>>['deliverables'];
  progressLogs: NonNullable<Awaited<ReturnType<typeof getItemDetail>>>['progressLogs'];
  changeLogs: NonNullable<Awaited<ReturnType<typeof getItemDetail>>>['changeLogs'];
}

export default function ItemDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ptext, setPtext] = useState('');
  const [parse, setParse] = useState<NonNullable<Awaited<ReturnType<typeof aiParseProgress>>> | null>(null);
  const [manualValue, setManualValue] = useState<number | null>(null);
  const [manualReason, setManualReason] = useState<ChangeReason | undefined>();
  const [manualNote, setManualNote] = useState('');
  const [upOpen, setUpOpen] = useState(false);
  const [kind, setKind] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [objectives, setObjectives] = useState<{ id: string; name: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getItemDetail(id);
      setDetail(res as unknown as Detail);
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
  }, [id]);

  if (loading) return <Card loading />;
  if (!detail) return <Alert type="error" message="工作包不存在" />;

  const { item, contract, deliverables, progressLogs, changeLogs } = detail;
  const published = contract.status === 'published';
  const check = checkItem(item);
  const monthMatchesContract = item.due_date ? item.due_date.slice(0, 7) === contract.month : false;

  const doParse = async () => {
    try {
      const res = await aiParseProgress(ptext, item.id);
      setParse(res);
    } catch (e) {
      if (isDegradable(e)) {
        message.warning('AI 暂不可用，请手工录入进度');
        setParse(null);
      } else {
        message.warning(toUserMessage(e));
      }
    }
  };

  const adopt = async (payload: { item_id: string; new_progress: number; delta: number }) => {
    try {
      await confirmProgress({
        item_id: payload.item_id,
        new_progress: payload.new_progress,
        raw_text: ptext || '（AI 解析采纳）',
        delta: payload.new_progress - item.progress,
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

  const doManual = async () => {
    if (manualValue === null) return;
    try {
      await manualProgress({ item_id: item.id, progress: manualValue, reason: manualReason, note: manualNote });
      message.success('手工进度已写入');
      setManualValue(null);
      setManualReason(undefined);
      setManualNote('');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const doUpload = async () => {
    try {
      await addDeliverable(item.id, {
        kind,
        file_type: kind === 'file' ? fileType || 'xlsx' : 'link',
        name: kind === 'file' ? fileName || '交付物文件' : linkUrl,
        url: kind === 'file' ? `mock://uploads/${Date.now()}.${fileType || 'xlsx'}` : linkUrl,
      });
      message.success('上传成功');
      setUpOpen(false);
      setFileName('');
      setLinkUrl('');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const quickObjectiveFix = async (objectiveId: string) => {
    try {
      await updateItem(item.id, { objective_id: objectiveId, reason: '上游调整' });
      message.success('已关联大目标并留痕');
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Title level={4} className="page-title">
        {item.title}
        <Tag style={{ marginLeft: 8 }}>{item.type}</Tag>
        <Tag color="blue">{`权重 ${item.weight}%`}</Tag>
        <Tag color="purple">{`优先级 ${item.priority}`}</Tag>
        <Tag>{CONTRACT_STATUS_TEXT[contract.status]}</Tag>
        {published && <Tag color="red">已发布只读</Tag>}
      </Typography.Title>

      <Row gutter={12}>
        <Col span={16}>
          <Card size="small" title="本月目标与交付物">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="本月目标">{item.target_desc}</Descriptions.Item>
              <Descriptions.Item label="关联大目标">
                {detail.objective?.name ?? '未关联'}
                {item.type !== '基础履职类' && (
                  <Select
                    size="small"
                    style={{ width: 240, marginLeft: 8 }}
                    placeholder="切换到…"
                    disabled={published}
                    options={objectives.map((o) => ({ value: o.id, label: o.name }))}
                    onChange={(v) => void quickObjectiveFix(v)}
                  />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="约定交付物">
                {item.deliverable_type} · {item.deliverable_desc}
              </Descriptions.Item>
              <Descriptions.Item label="计划截止日">
                {item.due_date}
                {!monthMatchesContract && <Tag color="red" style={{ marginLeft: 8 }}>截止日不在合约月份内</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="评分">
                {typeof item.score === 'number' ? `${item.score} 分（${item.score_basis || '无依据'}）` : '未评分'}
              </Descriptions.Item>
            </Descriptions>
            <div className="section-label">体检结果（FR-02 R4）</div>
            <Space wrap>
              <Tag color={check.score >= 90 ? 'green' : check.score >= 80 ? 'orange' : 'red'}>{check.score} 分</Tag>
              {check.issues.length === 0 ? <Tag color="green">无问题</Tag> : check.issues.map((x, k) => <Tag color="volcano" key={k}>{x}</Tag>)}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={`当前进度 ${item.progress}%`}>
            <Progress type="dashboard" percent={item.progress} />
            {!published && (
              <>
                <Input.TextArea
                  rows={2}
                  placeholder="说一句：今天完成了 8 个接口联调"
                  maxLength={500}
                  value={ptext}
                  style={{ marginTop: 8 }}
                  onChange={(e) => setPtext(e.target.value)}
                />
                <Space style={{ marginTop: 8 }}>
                  <Button type="primary" onClick={() => void doParse()} disabled={!ptext.trim()}>
                    AI 解析
                  </Button>
                </Space>
                {parse && (
                  <div style={{ marginTop: 8 }}>
                    <AIConfirmBar result={parse} rawText={ptext} onAdopt={(p) => void adopt(p)} onReject={() => setParse(null)} />
                  </div>
                )}
                <Space.Compact style={{ marginTop: 12, width: '100%' }}>
                  <Input
                    type="number"
                    placeholder="手工进度 0–100"
                    value={manualValue ?? ''}
                    onChange={(e) => setManualValue(e.target.value === '' ? null : Number(e.target.value))}
                  />
                  <Button onClick={() => void doManual()} disabled={manualValue === null}>
                    写入
                  </Button>
                </Space.Compact>
                {/* 回退 >20% 必须填写变更原因（FR-01 R4） */}
                {manualValue !== null && item.progress - manualValue > 20 && (
                  <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="回退超过 20%，请选择变更原因"
                      allowClear
                      value={manualReason}
                      onChange={(v) => setManualReason(v)}
                      options={CHANGE_REASONS.map((r) => ({ value: r, label: r }))}
                    />
                    <Input
                      placeholder="补充说明（留痕）"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                    />
                  </Space>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={`交付物（${deliverables.length}）`}
        extra={
          !published && (
            <Button icon={<UploadOutlined />} type="primary" onClick={() => setUpOpen(true)}>
              上传交付物
            </Button>
          )
        }
      >
        {deliverables.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            message="尚未上传交付物"
            description="月末评分时，未上传交付物的工作包最高 95 分（FR-03 R4）"
          />
        ) : (
          <List
            size="small"
            dataSource={deliverables}
            renderItem={(d) => (
              <List.Item
                actions={[
                  !published ? (
                    <Button danger type="link" size="small" onClick={() => void deleteDeliverable(d.id).then(load)}>
                      删除
                    </Button>
                  ) : null,
                ]}
              >
                <Space>
                  <Tag>{d.kind === 'file' ? d.file_type : '外链'}</Tag>
                  <span>{d.name}</span>
                  <Tooltip title={d.upload_at}>
                    <span style={{ color: '#bbb', fontSize: 12 }}>v{d.version} · {d.uploader}</span>
                  </Tooltip>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title="进度留痕（ProgressLog）">
            {progressLogs.length === 0 ? (
              <div style={{ color: '#bbb' }}>暂无留痕</div>
            ) : (
              <Timeline
                items={progressLogs.map((l) => ({
                  children: (
                    <div>
                      <b>{l.created_at}</b> · 变更 {l.delta >= 0 ? '+' : ''}{l.delta}%
                      <div style={{ color: '#666' }}>{l.raw_text}</div>
                      {l.ai_result && (
                        <div style={{ color: '#999', fontSize: 12 }}>
                          解析：{l.ai_result.item_id} → {l.ai_result.new_progress}%（置信度 {l.ai_result.confidence}）
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="变更留痕（ChangeLog）">
            {changeLogs.length === 0 ? (
              <div style={{ color: '#bbb' }}>暂无变更</div>
            ) : (
              <Timeline
                items={changeLogs.map((l) => ({
                  children: (
                    <div>
                      <b>{l.field}</b>：{l.old_value} → {l.new_value}
                      <div style={{ color: '#666' }}>原因：{l.reason} ｜ {l.note}</div>
                      <div style={{ color: '#bbb', fontSize: 12 }}>{l.operator} · {l.created_at}</div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        open={upOpen}
        title="上传交付物"
        okText="提交"
        onOk={() => void doUpload()}
        onCancel={() => setUpOpen(false)}
      >
        <Select
          value={kind}
          onChange={(v) => setKind(v)}
          style={{ width: '100%', marginBottom: 12 }}
          options={[
            { value: 'file', label: '本地文件（≤50MB）' },
            { value: 'link', label: '外部链接（GitLab MR / 报告链接）' },
          ]}
        />
        {kind === 'file' ? (
          <>
            <Upload
              beforeUpload={(f) => {
                const ext = (f.name.split('.').pop() || '').toLowerCase();
                if (!WHITELIST.includes(ext)) {
                  message.error('文件类型不支持，仅允许白名单类型');
                  return false;
                }
                if (f.size > MAX_MB * 1024 * 1024) {
                  message.error(`文件大小超过 ${MAX_MB}MB`);
                  return false;
                }
                setFileName(f.name);
                setFileType(ext);
                message.success(`已选择 ${f.name}`);
                return false; // 演示环境不真正上传
              }}
              accept={WHITELIST.map((e) => `.${e}`).join(',')}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            <Input placeholder="文件名" value={fileName} style={{ marginTop: 12 }} onChange={(e) => setFileName(e.target.value)} />
          </>
        ) : (
          <Input placeholder="https://gitlab.example.com/mr/123" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        )}
        <Alert type="info" showIcon style={{ marginTop: 12 }} message="请勿上传含客户敏感信息的文件（FR-07 R6）" />
      </Modal>

      <Space>
        <Button onClick={() => nav(-1)}>返回</Button>
        <Typography.Text type="secondary">当前月：{currentMonth()}</Typography.Text>
      </Space>
    </Space>
  );
}
