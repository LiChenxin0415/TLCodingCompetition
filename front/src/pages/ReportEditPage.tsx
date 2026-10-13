/**
 * P2 周报编辑页（成员核心页，同时复用于 P3 详情回填 与 P4 负责人代编辑）
 * 需求依据：5.3 P2、4.3 GEN-01~08、4.4 REP-01/02/03、4.5 LEAD-03/05、第七章边界
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Card, Input, Space, Spin, Typography } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AIGenerateButton from '../components/AIGenerateButton';
import ReportEditor from '../components/ReportEditor';
import StatusTag from '../components/StatusTag';
import {
  fetchMyReports,
  fetchReport,
  fetchTemplate,
  fetchTeamReports,
  generateReport,
  saveMyReport,
  updateReport,
} from '../services/api';
import { failureMessage } from '../services/http';
import { useAuthStore } from '../store/auth';
import { useEditorGuard } from '../store/editorGuard';
import type { FieldKey, ReportStatus, TemplateField } from '../types';
import {
  DEFAULT_TEMPLATE,
  fieldsToText,
  textToFields,
  validateFields,
} from '../utils/report';

/** GEN-03 输入区占位提示（需求原文） */
const INPUT_PLACEHOLDER =
  '试着写下你本周做了什么，口语化也没关系，例如：这周主要在弄登录和周报的接口，联调差不多弄完了，就差权限那块还没测……';

const INPUT_MAX = 2000; // GEN-02

type FieldText = Record<FieldKey, string>;

const EMPTY_TEXT: FieldText = { weekDone: '', ongoing: '', issues: '', nextPlan: '' };

export default function ReportEditPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const reportId = searchParams.get('id');
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const user = useAuthStore((state) => state.user);
  const week = useAuthStore((state) => state.week);
  const setDirty = useEditorGuard((state) => state.setDirty);

  const [template, setTemplate] = useState<TemplateField[]>(DEFAULT_TEMPLATE);
  const [fields, setFields] = useState<FieldText>(EMPTY_TEXT);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(reportId);
  const [status, setStatus] = useState<ReportStatus>('draft');
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [reportWeek, setReportWeek] = useState<string>(week);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [degraded, setDegraded] = useState(false);

  const loadedRef = useRef(false);

  /** 数据加载：模板 →（指定 id 的周报 或 本人本周周报） */
  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      try {
        setTemplate(await fetchTemplate());
      } catch {
        setTemplate(DEFAULT_TEMPLATE); // TPL-01 拉取失败时用兜底结构，保证页面可用
      }

      if (reportId !== null && reportId !== '') {
        const report = await fetchReport(reportId);
        setEditingId(report.id);
        setFields(fieldsToText(report));
        setStatus(report.status);
        setReportWeek(report.week);
        setOwnerId(report.userId);

        if (user !== null && report.userId !== user.id) {
          // 负责人代编辑：取成员姓名用于顶部提示（LEAD-03）
          setOwnerName(report.userId);
          try {
            const items = await fetchTeamReports(report.week);
            const matched = items.find((item) => item.user.id === report.userId);
            if (matched !== undefined) setOwnerName(matched.user.name);
          } catch {
            // 姓名取不到时退回 userId 展示
          }
        } else {
          setOwnerName(user?.name ?? '');
        }
      } else {
        // 未指定 id：回填本人本周已有周报（若有），实现 REP-03「同周次为更新」
        const mine = await fetchMyReports();
        const current = mine.find((item) => item.week === week);
        if (current !== undefined) {
          setEditingId(current.id);
          setFields(fieldsToText(current));
          setStatus(current.status);
          setReportWeek(current.week);
        }
        setOwnerName(user?.name ?? '');
        setOwnerId(user?.id ?? '');
      }
      setDirty(false);
    } catch (error) {
      message.error(failureMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, reportId, setDirty, user, week]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [load]);

  // 浏览器关闭 / 刷新前提示（第七章：未保存的修改将丢失）
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent): void => {
      if (useEditorGuard.getState().dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const isOwnReport = user === null || ownerId === '' || ownerId === user.id;
  const isLeader = user?.role === 'leader';
  /** LEAD-05：负责人界面不提供 AI 生成入口 */
  const showAiSection = !isLeader && !degraded;

  const hasEditorContent = useMemo(
    () => Object.values(fields).some((text) => text.trim() !== ''),
    [fields],
  );

  const markDirty = (): void => setDirty(true);

  const handleFieldChange = (key: FieldKey, text: string): void => {
    setFields((prev) => ({ ...prev, [key]: text }));
    markDirty();
  };

  const doGenerate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const result = await generateReport(input);
      setFields(fieldsToText(result));
      markDirty();
      setFailedCount(0);

      const empty =
        result.weekDone.length === 0 &&
        result.ongoing.length === 0 &&
        result.nextPlan.length === 0;
      if (empty) {
        // 后端 AI 未启用（GEN-07 降级）→ 直接进入模板填写模式
        setDegraded(true);
        message.warning('AI 当前为降级模式，请按模板手动填写四个字段');
      } else {
        message.success('AI 已生成，请确认后保存');
      }
    } catch (error) {
      setFailedCount((count) => count + 1);
      // 504 → 「生成失败，请重试」（GEN-06），不展示后端原始报错（6.3）
      message.error(failureMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateClick = (): void => {
    if (input.trim() === '') {
      message.warning('请先描述本周工作内容');
      return;
    }
    if (hasEditorContent) {
      // GEN-05 覆盖确认
      modal.confirm({
        title: '重新生成将覆盖当前内容，是否继续？',
        okText: '继续生成',
        cancelText: '取消',
        onOk: () => doGenerate(),
      });
      return;
    }
    void doGenerate();
  };

  const handleSave = async (nextStatus: ReportStatus): Promise<void> => {
    const payload = textToFields(fields);
    const validationError = validateFields(payload, template);
    if (validationError !== null) {
      message.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const saved =
        editingId === null
          ? await saveMyReport(payload, nextStatus)
          : await updateReport(editingId, payload, nextStatus);

      setEditingId(saved.id);
      setFields(fieldsToText(saved));
      setStatus(saved.status); // REP-02：已提交周报被编辑、后端回退 draft，以此为准
      setReportWeek(saved.week);
      setDirty(false);
      message.success(nextStatus === 'submitted' ? '周报已提交' : '已保存草稿');
    } catch (error) {
      message.error(failureMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin tip="加载中…" size="large">
          <div style={{ height: 80 }} />
        </Spin>
      </div>
    );
  }

  const isSubstitute = !isOwnReport;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space size={12} align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space size={12} align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>
            {isSubstitute ? '代编辑周报' : '本周周报'} · {reportWeek}
          </Typography.Title>
          <StatusTag status={status} />
        </Space>
        <Button onClick={() => void load()}>重新加载</Button>
      </Space>

      {isSubstitute ? (
        <Alert
          type="info"
          showIcon
          message={`正在查看：${ownerName} · ${reportWeek}`}
          description="负责人代编辑，保存后「最后编辑人」将更新为你（LEAD-03）。"
        />
      ) : null}

      {showAiSection ? (
        <Card title="① 随手写下你本周做了什么">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              允许口语化、无序、流水账；超过 {INPUT_MAX} 字会自动截断（GEN-02）。
            </Typography.Text>
            <Input.TextArea
              value={input}
              onChange={(event) => {
                setInput(event.target.value.slice(0, INPUT_MAX));
                markDirty();
              }}
              placeholder={INPUT_PLACEHOLDER}
              disabled={generating}
              maxLength={INPUT_MAX}
              showCount
              autoSize={{ minRows: 5, maxRows: 10 }}
            />
            <AIGenerateButton
              loading={generating}
              disabled={input.trim() === ''}
              failedCount={failedCount}
              onGenerate={handleGenerateClick}
              onSwitchToManual={() => {
                setDegraded(true);
                message.info('已切换为模板填写模式，请手动填写四个字段');
              }}
            />
          </Space>
        </Card>
      ) : (
        <Alert
          type={isLeader ? 'info' : 'warning'}
          showIcon
          message={isLeader ? '负责人界面不提供 AI 生成入口（LEAD-05）' : '当前为模板填写模式（GEN-07）'}
          description={
            isLeader
              ? '如需 AI 生成，请以成员本人账号登录后在其编辑页生成。'
              : '不调用 AI，按四字段模板手动填写，功能完整可用。'
          }
        />
      )}

      <Card title="② 标准周报（可编辑）">
        <ReportEditor
          template={template}
          value={fields}
          onChange={handleFieldChange}
          disabled={generating || saving}
        />
      </Card>

      <Space>
        <Button type="primary" loading={saving} onClick={() => void handleSave('draft')}>
          保存草稿
        </Button>
        <Button loading={saving} onClick={() => void handleSave('submitted')}>
          提交周报
        </Button>
        <Button type="link" onClick={() => navigate(isLeader ? '/team/reports' : '/my-reports')}>
          返回列表
        </Button>
      </Space>
    </Space>
  );
}
