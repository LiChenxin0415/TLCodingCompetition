/**
 * P3 我的周报列表页
 * 需求依据：5.4 P3、4.4 列表列定义（周次 / 状态 / 本周完成摘要 / 更新时间）
 * 交互：点击行进入该周周报详情（复用编辑区回填）；空态引导（禁止白屏）
 */

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import StatusTag from '../components/StatusTag';
import { fetchMyReports } from '../services/api';
import { failureMessage } from '../services/http';
import { useAuthStore } from '../store/auth';
import type { WeeklyReport } from '../types';
import { itemsToText, summarize } from '../utils/report';

export default function MyReportsPage(): JSX.Element {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const week = useAuthStore((state) => state.week);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setReports(await fetchMyReports());
    } catch (error) {
      message.error(failureMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<WeeklyReport> = [
    {
      title: '周次',
      dataIndex: 'week',
      width: 160,
      render: (value: string) => (
        <Space size={6}>
          <Typography.Text strong>{value}</Typography.Text>
          {value === week ? <Tag color="blue">本周</Tag> : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_value, record) => <StatusTag status={record.status} />,
    },
    {
      title: '本周完成摘要',
      render: (_value, record) => summarize(itemsToText(record.weekDone)),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的周报
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/report/edit')}>
          去写本周周报
        </Button>
      </Space>

      <Card styles={{ body: { padding: 0 } }}>
        {!loading && reports.length === 0 ? (
          <EmptyState
            description="还没有周报，点击上方按钮开始第一篇"
            actionText="去写本周周报"
            onAction={() => navigate('/report/edit')}
          />
        ) : (
          <Table<WeeklyReport>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={reports}
            pagination={false}
            onRow={(record) => ({
              onClick: () => navigate(`/report/edit?id=${encodeURIComponent(record.id)}`),
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </Card>
    </Space>
  );
}
