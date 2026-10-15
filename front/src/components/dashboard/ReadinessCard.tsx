import { Alert, Badge, Button, Card, Progress, Space, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { PublishReadiness } from '@/types';

interface Props {
  readiness: PublishReadiness;
  loading: boolean;
  month: string;
  /** 仅中心角色可进入校准页 */
  canCalibrate: boolean;
}

/** 发布前置校验（FR-09 R5）：三项全通过才允许「确认发布」 */
export default function ReadinessCard({ readiness, loading, month, canCalibrate }: Props) {
  const nav = useNavigate();
  const passed = readiness.checks.filter((c) => c.passed).length;
  const ratio = Math.round((passed / readiness.checks.length) * 100);

  return (
    <Card size="small" title="发布前置校验" loading={loading} className="dash-card">
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space align="center" size={12}>
          <Progress type="circle" size={64} percent={ratio} status={readiness.ok ? 'success' : 'exception'} />
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>
              {readiness.ok ? '全部校验通过，可发布' : `${readiness.checks.length - passed} 项待处理`}
            </div>
            <div style={{ color: '#999', fontSize: 12 }}>
              {month} · 已发布 {readiness.published_count}/{readiness.total_contract} 份合约
            </div>
          </div>
        </Space>
        {canCalibrate && (
          <Tooltip title={readiness.ok ? '进入校准与发布' : '存在未通过项，仍可进入查看明细'}>
            <Button type={readiness.ok ? 'primary' : 'default'} size="small" onClick={() => nav('/calibration')}>
              去校准发布
            </Button>
          </Tooltip>
        )}
      </Space>

      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {readiness.checks.map((c) => (
          <Alert
            key={c.key}
            type={c.passed ? 'success' : 'error'}
            showIcon
            message={
              <Space size={6} wrap>
                <Badge status={c.passed ? 'success' : 'error'} />
                <Typography.Text style={{ fontSize: 13 }}>{c.label}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {c.detail}
                </Typography.Text>
              </Space>
            }
          />
        ))}
      </Space>
    </Card>
  );
}
