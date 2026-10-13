/**
 * P4 成员周报管理页（负责人首页）
 * 需求依据：5.5 P4、4.5 LEAD-01/02/03（按成员分组、组内周次倒序、默认展开本周、代编辑）
 *
 * 实现说明：契约的 `GET /api/reports/team?week=` 按**周**返回全员周报，
 * 为满足 LEAD-01「组内按周次倒序」的历史展示，本页并行拉取最近 5 周后按成员合并；
 * 某成员本周无周报时补一行「本周未开始」灰字占位（不渲染空表）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Col, Row, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import StatusTag from '../components/StatusTag';
import { fetchTeamReports } from '../services/api';
import { failureMessage } from '../services/http';
import { useAuthStore } from '../store/auth';
import type { User, WeeklyReport } from '../types';
import { recentWeeks } from '../utils/week';

interface MemberGroup {
  user: User;
  reports: WeeklyReport[];
}

interface RowData {
  key: string;
  week: string;
  report: WeeklyReport | null;
  notStarted: boolean;
}

const ROLE_LABEL: Record<string, string> = { member: '成员', leader: '负责人' };

export default function TeamReportsPage(): JSX.Element {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const week = useAuthStore((state) => state.week);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const weeks = Array.from(new Set([week, ...recentWeeks(5)])).slice(0, 5);
      const results = await Promise.all(weeks.map((item) => fetchTeamReports(item)));

      const groupMap = new Map<string, MemberGroup>();
      const names: Record<string, string> = {};

      for (const items of results) {
        for (const item of items) {
          names[item.user.id] = item.user.name;
          const group = groupMap.get(item.user.id) ?? { user: item.user, reports: [] };
          if (item.report !== null) group.reports.push(item.report);
          groupMap.set(item.user.id, group);
        }
      }

      const merged = [...groupMap.values()].map((group) => ({
        ...group,
        reports: [...group.reports].sort((a, b) => (a.week < b.week ? 1 : -1)),
      }));

      setGroups(merged);
      setNameById(names);
    } catch (error) {
      message.error(failureMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, week]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowsOf = useCallback(
    (group: MemberGroup): RowData[] => {
      const rows: RowData[] = group.reports.map((report) => ({
        key: report.id,
        week: report.week,
        report,
        notStarted: false,
      }));
      if (!group.reports.some((report) => report.week === week)) {
        rows.unshift({ key: `${group.user.id}-not-started`, week, report: null, notStarted: true });
      }
      return rows;
    },
    [week],
  );

  const columns: ColumnsType<RowData> = useMemo(
    () => [
      {
        title: '周次',
        dataIndex: 'week',
        width: 150,
        render: (value: string) => (
          <Space size={6}>
            <Typography.Text strong>{value}</Typography.Text>
            {value === week ? <Tag color="blue">本周</Tag> : null}
          </Space>
        ),
      },
      {
        title: '状态',
        width: 110,
        render: (_value, record) =>
          record.notStarted ? (
            <Typography.Text type="secondary">未开始</Typography.Text>
          ) : (
            <StatusTag status={record.report?.status} />
          ),
      },
      {
        title: '更新时间',
        width: 180,
        render: (_value, record) =>
          record.report === null ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            record.report.updatedAt
          ),
      },
      {
        title: '最后编辑人',
        width: 140,
        render: (_value, record) =>
          record.report === null ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            (nameById[record.report.lastEditorId] ?? record.report.lastEditorId)
          ),
      },
      {
        title: '操作',
        width: 120,
        render: (_value, record) =>
          record.report === null ? null : (
            <Typography.Link
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/report/edit?id=${encodeURIComponent(record.report?.id ?? '')}`);
              }}
            >
              查看 / 代编辑
            </Typography.Link>
          ),
      },
    ],
    [nameById, navigate, week],
  );

  const totalReports = groups.reduce((sum, group) => sum + group.reports.length, 0);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          成员周报管理
        </Typography.Title>
        <Typography.Text type="secondary">
          共 {groups.length} 名成员 · {totalReports} 份周报（最近 5 周）
        </Typography.Text>
      </Space>

      {!loading && groups.length === 0 ? (
        <Card>
          <EmptyState description="暂无成员数据，请确认后端已启动并灌入种子数据（back: npm run seed）" />
        </Card>
      ) : null}

      <Row gutter={[16, 16]}>
        {groups.map((group) => (
          <Col span={24} key={group.user.id}>
            <Card
              loading={loading}
              title={
                <Space size={8}>
                  <Typography.Text strong>{group.user.name}</Typography.Text>
                  <Tag color={group.user.role === 'leader' ? 'blue' : 'default'}>
                    {ROLE_LABEL[group.user.role]}
                  </Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {group.user.id}
                  </Typography.Text>
                </Space>
              }
            >
              <Table<RowData>
                rowKey="key"
                size="small"
                columns={columns}
                dataSource={rowsOf(group)}
                pagination={false}
                onRow={(record) => ({
                  onClick: () => {
                    if (record.report !== null) {
                      navigate(`/report/edit?id=${encodeURIComponent(record.report.id)}`);
                    }
                  },
                  style: { cursor: record.report === null ? 'default' : 'pointer' },
                })}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );
}
