import { Alert, Button, Card, Checkbox, Input, Space, Tag, Timeline, Typography, Upload, message } from 'antd';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { adoptReport, createReport, listReports, parseReport } from '@/services/api';
import { isDegradable, toUserMessage } from '@/utils/error';
import dayjs from 'dayjs';
import type { ReportEntry } from '@/types';

const MAX_MB = 20; // 日报/周报 ≤20MB（FR-07 R2）
const WHITELIST = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'md', 'txt'];

interface Parsed {
  summary: string[];
  suggestions: { item_id: string; item_title: string; delta: number; reason: string }[];
  todo: string[];
}

export default function Reports() {
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily');
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM-DD'));
  const [content, setContent] = useState('');
  const [list, setList] = useState<ReportEntry[]>([]);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const load = async () => {
    try {
      setList(await listReports());
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    try {
      const r = await createReport({ kind, period, content });
      message.success(`已保存${kind === 'daily' ? '日报' : '周报'}（版本 v${r.version}）`);
      setContent('');
      await load();
      setActiveId(r.id);
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const doParse = async (id: string) => {
    setActiveId(id);
    setPicked([]);
    try {
      setParsed(await parseReport(id));
    } catch (e) {
      setParsed(null);
      if (isDegradable(e)) message.warning('AI 暂不可用，已仅保存文件');
      else message.error(toUserMessage(e));
    }
  };

  const doAdopt = async () => {
    if (!activeId) return;
    try {
      await adoptReport(activeId, picked);
      message.success(`已采纳 ${picked.length} 条进度建议并留痕`);
      setParsed(null);
      await load();
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Title level={4} className="page-title">
        日报 / 周报上传
      </Typography.Title>

      <Card size="small" title="上传或粘贴">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space>
            <Button.Group>
              <Button type={kind === 'daily' ? 'primary' : 'default'} onClick={() => setKind('daily')}>
                日报
              </Button>
              <Button type={kind === 'weekly' ? 'primary' : 'default'} onClick={() => setKind('weekly')}>
                周报
              </Button>
            </Button.Group>
            <Input
              style={{ width: 260 }}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder={kind === 'daily' ? '日期 YYYY-MM-DD' : '日期区间 YYYY-MM-DD~YYYY-MM-DD'}
            />
            <Upload
              beforeUpload={(f) => {
                const ext = (f.name.split('.').pop() || '').toLowerCase();
                if (!WHITELIST.includes(ext)) {
                  message.error('文件类型不支持');
                  return false;
                }
                if (f.size > MAX_MB * 1024 * 1024) {
                  message.error(`文件大小超过 ${MAX_MB}MB`);
                  return false;
                }
                setContent((c) => `${c}\n[已选择文件] ${f.name}`);
                return false;
              }}
              accept={WHITELIST.map((e) => `.${e}`).join(',')}
            >
              <Button>选择文件</Button>
            </Upload>
          </Space>
          <Input.TextArea
            rows={5}
            maxLength={2000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="或直接粘贴文本（≤2000 字）"
          />
          <Space>
            <Button type="primary" onClick={() => void submit()} disabled={!content.trim()}>
              提交
            </Button>
            <Typography.Text type="secondary">支持 {WHITELIST.join(' / ')}，单文件 ≤{MAX_MB}MB</Typography.Text>
          </Space>
          <Alert type="warning" showIcon message="请勿上传含客户敏感信息的文件（FR-07 R6）" />
        </Space>
      </Card>

      {parsed && (
        <Card size="small" title="AI 解析结果（不自动入库，需逐条勾选采纳，FR-07 R4）">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <b>要点摘要</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {parsed.summary.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <b>建议关联的工作包</b>
              <Space direction="vertical">
                {parsed.suggestions.map((s) => (
                  <Checkbox
                    key={s.item_id}
                    checked={picked.includes(s.item_id)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.item_id] : p.filter((x) => x !== s.item_id)))}
                  >
                    {s.item_title} <Tag color="blue">+{s.delta}%</Tag>
                    <span style={{ color: '#999' }}>{s.reason}</span>
                  </Checkbox>
                ))}
              </Space>
            </div>
            <Space>
              <Button type="primary" onClick={() => void doAdopt()} disabled={!picked.length}>
                采纳并更新进度
              </Button>
              <Button onClick={() => setParsed(null)}>取消</Button>
            </Space>
          </Space>
        </Card>
      )}

      <Card size="small" title="我的日报周报">
        {list.length === 0 ? (
          <EmptyState description="暂无上传记录" />
        ) : (
          <Timeline
            items={list.map((r) => ({
              children: (
                <Space direction="vertical" size={2}>
                  <Space>
                    <Tag color={r.kind === 'daily' ? 'blue' : 'purple'}>{r.kind === 'daily' ? '日报' : '周报'}</Tag>
                    <b>{r.period}</b>
                    <span style={{ color: '#999' }}>v{r.version}</span>
                  </Space>
                  <div style={{ color: '#666' }}>{r.content_ref.slice(0, 80)}</div>
                  <Space>
                    <Button size="small" type="link" onClick={() => void doParse(r.id)}>
                      AI 解析
                    </Button>
                    {r.linked_item_ids.length > 0 && <Tag color="green">已关联 {r.linked_item_ids.length} 个</Tag>}
                  </Space>
                </Space>
              ),
            }))}
          />
        )}
      </Card>
    </Space>
  );
}
