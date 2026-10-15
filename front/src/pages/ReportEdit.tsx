import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Input, Space, Spin, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import AIGenerateButton from '@/components/AIGenerateButton';
import ReportEditor from '@/components/ReportEditor';
import { createReport, getMyReports, getTeamReports, updateReport } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { useDirtyStore } from '@/store/dirty';
import { useTemplateStore } from '@/store/template';
import { toUserMessage } from '@/utils/error';
import { currentWeek } from '@/utils/isoWeek';
import type { Report, ReportFields, ReportStatus } from '@/types';

const EMPTY_FIELDS: ReportFields = { weekDone: [], ongoing: [], issues: [], nextPlan: [] };

/** P2 周报编辑页：输入 → AI 生成 → 编辑 → 保存/提交（member 首页；leader 可代编辑） */
export default function ReportEdit() {
  const [params] = useSearchParams();
  const week = params.get('week') || currentWeek();
  const targetUserId = params.get('userId'); // leader 代编辑目标（LEAD-03）

  const { user } = useAuthStore();
  const setDirty = useDirtyStore((s) => s.setDirty);
  const dirty = useDirtyStore((s) => s.dirty);
  const { message } = App.useApp();
  const fields = useTemplateStore((s) => s.fields);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState('');
  const [value, setValue] = useState<ReportFields>(EMPTY_FIELDS);
  const [status, setStatus] = useState<ReportStatus>('draft');
  const [reportId, setReportId] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  const isLeader = user?.role === 'leader';
  const proxyEdit = Boolean(targetUserId && targetUserId !== user?.id);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let report: Report | null = null;
      if (isLeader) {
        const rows = await getTeamReports(week);
        report = rows.find((r) => r.user.id === (targetUserId ?? user.id))?.report ?? null;
      } else {
        const list = await getMyReports();
        report = list.find((r) => r.week === week) ?? null;
      }
      if (report) {
        setReportId(report.id);
        setStatus(report.status);
        setValue({
          weekDone: report.weekDone ?? [],
          ongoing: report.ongoing ?? [],
          issues: report.issues ?? [],
          nextPlan: report.nextPlan ?? [],
        });
      } else {
        setReportId(null);
        setValue(EMPTY_FIELDS);
      }
    } catch (err) {
      message.error(toUserMessage(err));
    } finally {
      setLoading(false);
      setDirty(false);
    }
  }, [user, week, targetUserId, isLeader, message, setDirty]);

  useEffect(() => {
    void load();
  }, [load]);

  // 离开页面前提示未保存（第七章 / TC-EDGE-01）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const hasContent = useMemo(
    () => Object.values(value).some((arr: string[]) => arr.some((s: string) => s.trim())),
    [value],
  );

  const onEditorChange = (next: ReportFields) => {
    setValue(next);
    setDirty(true);
  };

  const save = async (nextStatus: ReportStatus) => {
    setSaving(true);
    try {
      const payload = { ...value, status: nextStatus };
      let saved: Report;
      if (reportId) {
        saved = await updateReport(reportId, payload);
      } else {
        saved = await createReport(payload);
      }
      setReportId(saved.id);
      setStatus(saved.status);
      setDirty(false);
      message.success(nextStatus === 'submitted' ? '周报已提交' : '草稿已保存');
    } catch (err) {
      message.error(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin tip="加载中…" />
      </div>
    );
  }

  return (
    <div className="page">
      <Typography.Title level={4} className="page-title">
        周报编辑 · {week}
      </Typography.Title>
      {proxyEdit && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`正在查看：${targetUserId} · ${week}（负责人代编辑，保存后记录最后编辑人）`}
        />
      )}
      {degraded && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="已切换为模板填写模式"
          description="AI 生成暂时不可用，你可以直接在下方四字段中手动填写。"
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        {!isLeader && (
          <>
            <div className="section-label">① 随手写下你本周做了什么</div>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              showCount
              autoSize={{ minRows: 4, maxRows: 8 }}
              placeholder="例如：这周主要在弄登录和周报的接口，联调差不多弄完了，就差权限那块还没测…"
            />
            <div style={{ marginTop: 12 }}>
              {!degraded && (
                <AIGenerateButton
                  input={input}
                  hasContent={hasContent}
                  onResult={(f) => {
                    setValue(f);
                    setDirty(true);
                  }}
                  onDegrade={() => setDegraded(true)}
                />
              )}
            </div>
          </>
        )}
        {isLeader && (
          <Typography.Text type="secondary">
            负责人视角：可直接编辑成员周报内容，保存后状态与最后编辑人会同步更新。
          </Typography.Text>
        )}
      </Card>

      <Card>
        <div className="section-label">② 标准周报（可编辑）</div>
        <ReportEditor value={value} onChange={onEditorChange} fields={fields} />
        <div style={{ marginTop: 24 }}>
          <Space>
            <Button
              onClick={() => save('draft')}
              loading={saving}
              disabled={saving}
            >
              保存草稿
            </Button>
            <Button type="primary" onClick={() => save('submitted')} loading={saving} disabled={saving}>
              提交周报
            </Button>
            <Typography.Text type="secondary">
              当前状态：{status === 'submitted' ? '已提交' : '草稿'}
              {status === 'submitted' && '（再次编辑保存后回退为草稿）'}
            </Typography.Text>
          </Space>
        </div>
      </Card>
    </div>
  );
}
