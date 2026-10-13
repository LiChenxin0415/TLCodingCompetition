/**
 * P5 团队总览页
 * 需求依据：5.6 P5、4.6.1 总览列表（OVR-01~04）、4.6.2 AI 团队周报（OVR-05~09）
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Divider,
  Popover,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import RiskTag from '../components/RiskTag';
import StatusTag from '../components/StatusTag';
import { exportTeamSummary, fetchTeamReports, generateTeamSummary } from '../services/api';
import { failureMessage } from '../services/http';
import { useAuthStore } from '../store/auth';
import type { TeamReportItem, TeamSummary } from '../types';
import { hasRisk } from '../utils/report';
import { copyText, downloadBlob, summaryToText } from '../utils/summary';

type FilterKey = 'all' | 'submitted' | 'unsubmitted';

const ROLE_LABEL: Record<string, string> = { member: '成员', leader: '负责人' };

/** 条目列表：最多展示 max 条，超出折叠为 +N（OVR-01 / 4.6.1） */
function ItemList({ items, max = 3 }: { items: string[]; max?: number }): JSX.Element {
  if (items.length === 0) return <Typography.Text type="secondary">—</Typography.Text>;

  const visible = items.slice(0, max);
  const rest = items.slice(max);

  return (
    <div>
      {visible.map((item) => (
        <div key={item} style={{ fontSize: 13 }}>
          · {item}
        </div>
      ))}
      {rest.length > 0 ? (
        <Popover
          title="全部条目"
          content={
            <div style={{ maxWidth: 360 }}>
              {items.map((item) => (
                <div key={item} style={{ fontSize: 13 }}>
                  · {item}
                </div>
              ))}
            </div>
          }
        >
          <Typography.Link style={{ fontSize: 12 }}>+{rest.length} 条</Typography.Link>
        </Popover>
      ) : null}
    </div>
  );
}

export default function TeamOverviewPage(): JSX.Element {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const week = useAuthStore((state) => state.week);

  const [items, setItems] = useState<TeamReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setItems(await fetchTeamReports(week));
    } catch (error) {
      message.error(failureMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, week]);

  useEffect(() => {
    void load();
  }, [load]);

  const submittedCount = items.filter((item) => item.report?.status === 'submitted').length;
  const hasAnyReport = items.some((item) => item.report !== null);

  /** OVR-02：有风险的成员置顶，其余按姓名固定顺序 */
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const riskA = a.report === null || hasRisk(a.report.issues) ? 1 : 0;
      const riskB = b.report === null || hasRisk(b.report.issues) ? 1 : 0;
      if (riskA !== riskB) return riskB - riskA;
      return a.user.name.localeCompare(b.user.name, 'zh-Hans-CN');
    });
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'submitted') return sorted.filter((item) => item.report?.status === 'submitted');
    if (filter === 'unsubmitted') return sorted.filter((item) => item.report?.status !== 'submitted');
    return sorted;
  }, [filter, sorted]);

  const handleGenerate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const result = await generateTeamSummary(week);
      setSummary(result);
      setFailedCount(0);
      message.success('团队周报已生成');
    } catch (error) {
      setFailedCount((count) => count + 1);
      message.error(failureMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateClick = (): void => {
    if (summary !== null) {
      // OVR-07：重新生成覆盖前二次确认
      modal.confirm({
        title: '重新生成将覆盖当前团队周报，是否继续？',
        okText: '继续生成',
        cancelText: '取消',
        onOk: () => handleGenerate(),
      });
      return;
    }
    void handleGenerate();
  };

  const handleCopy = async (): Promise<void> => {
    if (summary === null) return;
    const ok = await copyText(summaryToText(summary));
    if (ok) message.success('已复制全文（四段纯文本）');
    else message.warning('复制失败，请手动选择文本复制');
  };

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const { blob, filename } = await exportTeamSummary(week);
      downloadBlob(blob, filename);
      message.success(`已导出 ${filename}`);
    } catch (error) {
      message.error(failureMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnsType<TeamReportItem> = [
    {
      title: '成员',
      width: 170,
      render: (_value, item) => (
        <Space size={6}>
          <Typography.Text strong>{item.user.name}</Typography.Text>
          <Tag color={item.user.role === 'leader' ? 'blue' : 'default'}>
            {ROLE_LABEL[item.user.role]}
          </Tag>
        </Space>
      ),
    },
    {
      title: '提交状态',
      width: 110,
      render: (_value, item) =>
        item.report === null ? (
          <Typography.Text type="secondary">未开始</Typography.Text>
        ) : (
          <StatusTag status={item.report.status} />
        ),
    },
    {
      title: '本周完成',
      width: 280,
      render: (_value, item) => <ItemList items={item.report?.weekDone ?? []} max={3} />,
    },
    {
      title: '进行中',
      width: 220,
      render: (_value, item) => <ItemList items={item.report?.ongoing ?? []} max={3} />,
    },
    {
      title: '风险',
      width: 130,
      render: (_value, item) => (
        <RiskTag items={item.report?.issues} notStarted={item.report === null} />
      ),
    },
    {
      title: '更新时间',
      width: 170,
      render: (_value, item) =>
        item.report === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          item.report.updatedAt
        ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space size={12} align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>
            团队周报总览 · {week}
          </Typography.Title>
          <Typography.Text type="secondary">
            已提交 {submittedCount}/{items.length}
          </Typography.Text>
        </Space>
        <Button onClick={() => void load()} loading={loading}>
          刷新
        </Button>
      </Space>

      {!loading && !hasAnyReport ? (
        <Card>
          {/* OVR-03：全员未提交 → 空态文案，不渲染空表 */}
          <EmptyState
            description="本周还没有成员提交周报，去成员管理页查看详情"
            actionText="去成员管理页"
            onAction={() => navigate('/team/reports')}
          />
        </Card>
      ) : (
        <Card
          title={
            <Segmented<FilterKey>
              value={filter}
              onChange={(value) => setFilter(value)}
              options={[
                { label: '全部', value: 'all' },
                { label: '已提交', value: 'submitted' },
                { label: '未提交', value: 'unsubmitted' },
              ]}
            />
          }
        >
          <Table<TeamReportItem>
            rowKey={(item) => item.user.id}
            loading={loading}
            columns={columns}
            dataSource={filtered}
            pagination={false}
          />
        </Card>
      )}

      <Card title="AI 团队周报">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space>
            <Popover
              content={hasAnyReport ? '' : '暂无可汇总的周报'}
              open={hasAnyReport ? false : undefined}
            >
              <Button
                type="primary"
                loading={generating}
                disabled={!hasAnyReport || generating}
                onClick={handleGenerateClick}
              >
                {generating ? 'AI 正在汇总团队周报…' : '生成团队周报'}
              </Button>
            </Popover>
            {summary !== null ? (
              <Space>
                <Button onClick={() => void handleCopy()}>复制全文</Button>
                <Button loading={exporting} onClick={() => void handleExport()}>
                  导出 .txt
                </Button>
              </Space>
            ) : null}
          </Space>

          {!hasAnyReport ? (
            <Alert type="info" showIcon message="暂无可汇总的周报" description="本周没有任何成员保存过周报，生成按钮已置灰（OVR-05）。" />
          ) : null}

          {failedCount >= 2 && summary === null ? (
            <Alert
              type="warning"
              showIcon
              message="团队周报生成连续失败"
              description="可点击「生成团队周报」重试；若 AI 不可用，可稍后重试或使用降级模式（后端 AI_ENABLED=false 时返回规则化汇总）。"
            />
          ) : null}

          {summary === null ? (
            <Typography.Text type="secondary">
              点击上方按钮，AI 帮你把全员周报汇总成团队周报。
            </Typography.Text>
          ) : (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Typography.Title level={5}>整体进展</Typography.Title>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                  {summary.overall}
                </Typography.Paragraph>
              </div>
              <div>
                <Typography.Title level={5}>关键成果</Typography.Title>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {summary.achievements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <Typography.Title level={5}>风险集中点</Typography.Title>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {summary.risks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <Typography.Title level={5}>下周重点</Typography.Title>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {summary.nextFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                提示：团队周报为生成时快照，成员后续修改不会自动更新，需重新生成（OVR-09）。
              </Typography.Text>
            </>
          )}
        </Space>
      </Card>
    </Space>
  );
}
