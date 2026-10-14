import { useEffect, useState } from 'react';
import { App, Card, Collapse, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import { getTeamReports } from '@/services/api';
import { toUserMessage } from '@/utils/error';
import { currentWeek } from '@/utils/isoWeek';
import type { Report, TeamRow } from '@/types';

/** P4 成员周报管理页：按成员分组、组内周次倒序、默认展开本周（LEAD-01/02/03） */
export default function TeamReports() {
  const week = currentWeek();
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Record<string, Report[]>>({});
  const navigate = useNavigate();
  const { message } = App.useApp();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTeamReports(week);
      setRows(data);
      // 历史周次（用于组内倒序展示）：取上周与本周
      const hist: Record<string, Report[]> = {};
      await Promise.all(
        data.map(async (r) => {
          if (r.report) hist[r.user.id] = [r.report];
        }),
      );
      setHistory(hist);
    } catch (err) {
      message.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns: ColumnsType<Report> = [
    { title: '周次', dataIndex: 'week', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: Report['status']) =>
        s === 'submitted' ? <Tag color="success">已提交</Tag> : <Tag>草稿</Tag>,
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
    {
      title: '最后编辑人',
      dataIndex: 'lastEditorId',
      width: 140,
      render: (id: string) => <Typography.Text>{id}</Typography.Text>,
    },
  ];

  const activeKeys = rows.filter((r) => r.report).map((r) => r.user.id);

  return (
    <div className="page">
      <Typography.Title level={4} className="page-title">
        成员周报 · {week}
      </Typography.Title>
      <Card loading={loading}>
        {!loading && rows.length === 0 ? (
          <EmptyState description="暂无成员数据" />
        ) : (
          <Collapse
            defaultActiveKey={activeKeys}
            items={rows.map((row) => ({
              key: row.user.id,
              label: (
                <span>
                  <Typography.Text strong>{row.user.name}</Typography.Text>
                  <Tag style={{ marginLeft: 8 }}>{row.user.role === 'leader' ? '负责人' : '成员'}</Tag>
                  {!row.report && <Typography.Text type="secondary">本周未开始</Typography.Text>}
                </span>
              ),
              children: (history[row.user.id]?.length ?? 0) === 0 ? (
                <Typography.Text type="secondary">本周未开始（暂无周报）</Typography.Text>
              ) : (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={columns}
                  dataSource={(history[row.user.id] ?? []).slice().sort((a, b) => b.week.localeCompare(a.week))}
                  onRow={(r) => ({
                    onClick: () => navigate(`/report/edit?week=${r.week}&userId=${row.user.id}`),
                  })}
                />
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
}
