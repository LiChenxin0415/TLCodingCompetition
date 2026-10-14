import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Popover, Segmented, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import EmptyState from '@/components/EmptyState';
import RiskTag from '@/components/RiskTag';
import { exportTeamSummary, generateTeamSummary, getTeamReports } from '@/services/api';
import { toUserMessage } from '@/utils/error';
import { buildSummaryText, copyText, downloadText, summaryOf } from '@/utils/file';
import { currentWeek } from '@/utils/isoWeek';
import type { TeamRow, TeamSummary } from '@/types';

type Filter = 'all' | 'submitted' | 'unsubmitted';

/** P5 团队总览页（OVR-01~08） */
export default function TeamOverview() {
  const week = currentWeek();
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [genLoading, setGenLoading] = useState(false);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [genFailed, setGenFailed] = useState(false);
  const { message, modal } = App.useApp();

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getTeamReports(week));
    } catch (err) {
      message.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const dataSource = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'submitted') return r.report?.status === 'submitted';
      if (filter === 'unsubmitted') return r.report?.status !== 'submitted';
      return true;
    });
  }, [rows, filter]);

  const anyReport = rows.some((r) => r.report);

  const columns: ColumnsType<TeamRow> = [
    {
      title: '成员',
      dataIndex: ['user', 'name'],
      width: 120,
      render: (_v, r) => (
        <span>
          {r.user.name} <Tag>{r.user.id}</Tag>
        </span>
      ),
    },
    {
      title: '提交状态',
      width: 110,
      render: (_v, r) =>
        !r.report ? (
          <Typography.Text type="secondary">未开始</Typography.Text>
        ) : r.report.status === 'submitted' ? (
          <Tag color="success">已提交</Tag>
        ) : (
          <Tag>草稿</Tag>
        ),
    },
    {
      title: '本周完成',
      render: (_v, r) => {
        const items = r.report?.weekDone ?? [];
        if (!items.length) return <Typography.Text type="secondary">—</Typography.Text>;
        const shown = items.slice(0, 3);
        const rest = items.slice(3);
        return (
          <span>
            {shown.map((i, idx) => (
              <div key={idx}>{i}</div>
            ))}
            {rest.length > 0 && (
              <Popover
                content={
                  <div style={{ maxWidth: 280 }}>
                    {rest.map((i, idx) => (
                      <div key={idx}>{i}</div>
                    ))}
                  </div>
                }
              >
                <Tag color="blue" style={{ cursor: 'pointer' }}>
                  +{rest.length}
                </Tag>
              </Popover>
            )}
          </span>
        );
      },
    },
    {
      title: '进行中',
      width: 200,
      render: (_v, r) => summaryOf(r.report?.ongoing) || '—',
    },
    {
      title: '风险',
      width: 130,
      render: (_v, r) => <RiskTag issues={r.report?.issues} notStarted={!r.report} />,
    },
    {
      title: '更新时间',
      width: 170,
      render: (_v, r) => r.report?.updatedAt ?? '—',
    },
  ];

  const doGenerate = async () => {
    setGenLoading(true);
    setGenFailed(false);
    try {
      setSummary(await generateTeamSummary(week));
    } catch (err) {
      setGenFailed(true);
      message.error(toUserMessage(err));
    } finally {
      setGenLoading(false);
    }
  };

  const handleGenerate = () => {
    if (summary) {
      modal.confirm({
        title: '重新生成将覆盖当前团队周报',
        content: '已生成内容会被覆盖（当前为快照，不会自动跟随成员修改更新）',
        okText: '重新生成',
        cancelText: '取消',
        onOk: doGenerate,
      });
      return;
    }
    void doGenerate();
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          团队周报总览 · {week}
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          刷新
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { label: '全部', value: 'all' },
              { label: '已提交', value: 'submitted' },
              { label: '未提交', value: 'unsubmitted' },
            ]}
          />
        </Space>
        {!loading && rows.length === 0 ? (
          <EmptyState description="暂无成员数据" />
        ) : (
          <Table rowKey={(r) => r.user.id} loading={loading} columns={columns} dataSource={dataSource} pagination={false} />
        )}
      </Card>

      <Card
        title="AI 团队周报"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={genLoading}
              disabled={!anyReport || genLoading}
              onClick={handleGenerate}
              title={anyReport ? '' : '暂无可汇总的周报'}
            >
              {genLoading ? 'AI 正在汇总…' : '生成团队周报'}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!summary}
              onClick={async () => {
                try {
                  const { filename, content } = await exportTeamSummary(week);
                  downloadText(filename, content);
                  message.success('已导出');
                } catch (err) {
                  message.error(toUserMessage(err));
                }
              }}
            >
              导出 .txt
            </Button>
            <Button
              disabled={!summary}
              onClick={async () => {
                if (!summary) return;
                const ok = await copyText(buildSummaryText(week, summary));
                message[ok ? 'success' : 'error'](ok ? '已复制全文' : '复制失败，请手动选择文本');
              }}
            >
              复制全文
            </Button>
          </Space>
        }
      >
        {!anyReport && (
          <Typography.Text type="secondary">暂无可汇总的周报（本周还没有任何成员保存周报）</Typography.Text>
        )}
        {anyReport && !summary && !genFailed && (
          <Typography.Text type="secondary">
            点击「生成团队周报」，AI 帮你把全员周报汇总成一段团队周报
          </Typography.Text>
        )}
        {genFailed && (
          <Typography.Text type="danger">生成失败，请点击重试；若持续失败可手动整理后导出。</Typography.Text>
        )}
        {summary && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Typography.Text strong>整体进展</Typography.Text>
              <div>{summary.overall}</div>
            </div>
            <div>
              <Typography.Text strong>关键成果</Typography.Text>
              {summary.achievements.map((i, idx) => (
                <div key={idx}>- {i}</div>
              ))}
            </div>
            <div>
              <Typography.Text strong>风险集中点</Typography.Text>
              {summary.risks.map((i, idx) => (
                <div key={idx}>- {i}</div>
              ))}
            </div>
            <div>
              <Typography.Text strong>下周重点</Typography.Text>
              {summary.nextFocus.map((i, idx) => (
                <div key={idx}>- {i}</div>
              ))}
            </div>
          </Space>
        )}
      </Card>
    </div>
  );
}
