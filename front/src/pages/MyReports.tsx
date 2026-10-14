import { useEffect, useState } from 'react';
import { App, Button, Card, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import { getMyReports } from '@/services/api';
import { toUserMessage } from '@/utils/error';
import { summaryOf } from '@/utils/file';
import type { Report } from '@/types';

/** P3 我的周报列表页（需求 4.4） */
export default function MyReports() {
  const [list, setList] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const load = async () => {
    setLoading(true);
    try {
      setList(await getMyReports());
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
    {
      title: '本周完成摘要',
      dataIndex: 'weekDone',
      render: (_v, r) => summaryOf(r.weekDone) || '—',
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} className="page-title" style={{ margin: 0 }}>
          我的周报
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/report/edit')}>
          去写本周周报
        </Button>
      </div>
      <Card>
        {!loading && list.length === 0 ? (
          <EmptyState description="还没有周报" guide="点击上方「去写本周周报」开始第一篇" />
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={list}
            pagination={false}
            onRow={(r) => ({ onClick: () => navigate(`/report/edit?week=${r.week}`) })}
            rowClassName={() => 'clickable-row'}
          />
        )}
      </Card>
    </div>
  );
}
