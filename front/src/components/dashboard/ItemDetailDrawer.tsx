import { Alert, Button, Card, Descriptions, Drawer, Empty, Space, Spin, Tag, Timeline, Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getItemDetail } from '@/services/api';
import RiskTag from '@/components/RiskTag';
import ProgressBar from '@/components/ProgressBar';
import { riskStatus, scoreTier } from '@/utils/rules';
import { CONTRACT_STATUS_TEXT } from '@/types';
import type { DrilldownRow } from '@/types';

type Detail = Awaited<ReturnType<typeof getItemDetail>>;

interface Props {
  row: DrilldownRow | null;
  onClose: () => void;
}

/** 工作包详情抽屉（FR-05 R3）：含进度留痕、交付物、变更记录，只读 */
export default function ItemDetailDrawer({ row, onClose }: Props) {
  const nav = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!row) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setErr('');
    getItemDetail(row.id)
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : '加载失败'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [row]);

  const it = data?.item;

  return (
    <Drawer open={Boolean(row)} title="工作包详情（只读）" width={620} onClose={onClose}>
      {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 12 }} />}
      {loading && <Spin style={{ display: 'block', margin: '48px auto' }} />}

      {!loading && data && it && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="工作包" span={2}>
              <Typography.Text strong>{it.title}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="成员">{data.owner.name}</Descriptions.Item>
            <Descriptions.Item label="合约月份">{data.contract.month}</Descriptions.Item>
            <Descriptions.Item label="类型">{it.type}</Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={it.priority === '高' ? 'red' : it.priority === '中' ? 'orange' : 'default'}>{it.priority}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="权重">{it.weight}%</Descriptions.Item>
            <Descriptions.Item label="截止日">{it.due_date}</Descriptions.Item>
            <Descriptions.Item label="大目标" span={2}>
              {data.objective ? data.objective.name : <span style={{ color: '#ccc' }}>未关联</span>}
            </Descriptions.Item>
            <Descriptions.Item label="进度" span={2}>
              <ProgressBar value={it.progress} height={8} showText />
            </Descriptions.Item>
            <Descriptions.Item label="风险状态">
              <RiskTag status={riskStatus(it)} />
            </Descriptions.Item>
            <Descriptions.Item label="交付物">
              {data.deliverables.length ? <Tag color="green">已上传 {data.deliverables.length} 份</Tag> : <Tag color="red">未上传</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="合约状态">{CONTRACT_STATUS_TEXT[data.contract.status]}</Descriptions.Item>
            <Descriptions.Item label="评分">
              {typeof it.score === 'number' ? (
                <Tooltip title={scoreTier(it.score)}>
                  <span className="mono" style={{ fontWeight: 600 }}>{it.score} 分</span>
                </Tooltip>
              ) : (
                <span style={{ color: '#ccc' }}>未评分</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="本月目标" span={2}>
              {it.target_desc}
            </Descriptions.Item>
            {it.score_basis && (
              <Descriptions.Item label="评分依据" span={2}>{it.score_basis}</Descriptions.Item>
            )}
          </Descriptions>

          <Card size="small" title="交付物">
            {data.deliverables.length === 0 ? (
              <Empty description="未上传交付物" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {data.deliverables.map((d) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{d.name}</span>
                    <span style={{ color: '#999' }}>v{d.version} · {d.upload_at}</span>
                  </div>
                ))}
              </Space>
            )}
          </Card>

          <Card size="small" title="进度留痕（ProgressLog）">
            {data.progressLogs.length === 0 ? (
              <Empty description="暂无进度留痕" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={data.progressLogs.map((l) => ({
                  children: (
                    <Space direction="vertical" size={0}>
                      <Typography.Text style={{ fontSize: 13 }}>“{l.raw_text}”</Typography.Text>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {l.ai_result
                          ? `AI 识别 → ${l.ai_result.new_progress}%（${l.ai_result.delta > 0 ? '+' : ''}${l.ai_result.delta}%）· 置信度 ${l.ai_result.confidence}`
                          : '手工更新'}
                        {' · '}
                        <span className="mono">{l.created_at}</span>
                      </span>
                    </Space>
                  ),
                }))}
              />
            )}
          </Card>

          <Card size="small" title="变更记录（ChangeLog）">
            {data.changeLogs.length === 0 ? (
              <Empty description="暂无变更记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={data.changeLogs.map((l) => ({
                  children: (
                    <Space direction="vertical" size={0}>
                      <Typography.Text style={{ fontSize: 13 }}>
                        {l.field}：{l.old_value} → {l.new_value}
                      </Typography.Text>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {l.reason} {l.note && `· ${l.note}`} · <span className="mono">{l.created_at}</span>
                      </span>
                    </Space>
                  ),
                }))}
              />
            )}
          </Card>

          <Alert type="info" showIcon message="明细含进度留痕、交付物、变更记录，均为只读（FR-05 R3）；已发布月份数据不可修改" />
          <Button block onClick={() => nav(`/items/${row?.id}`)}>打开完整详情页</Button>
        </Space>
      )}
    </Drawer>
  );
}
