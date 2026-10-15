import { Card, Col, Row, Space, Statistic, Tooltip } from 'antd';
import type { MetricCard as Metric, MetricKey } from '@/types';

/** 每张卡对应的语义图标字符（避免引入图标包，保持依赖精简） */
const GLYPH: Record<MetricKey, string> = {
  total: '▦',
  risk: '⚠',
  done: '✓',
  published: '◎',
  avgScore: '★',
  avgProgress: '↗',
};

const TONE_VAR: Record<Metric['tone'], { color: string; bg: string; border: string }> = {
  default: { color: '#595959', bg: '#fafafa', border: '#f0f0f0' },
  primary: { color: '#1677ff', bg: '#f0f7ff', border: '#add2ff' },
  success: { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
  warning: { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' },
  danger: { color: '#ff4d4f', bg: '#fff1f0', border: '#ffa39e' },
};

interface Props {
  metrics: Metric[];
  loading: boolean;
  activeKey?: MetricKey;
  onDrill: (key: MetricKey) => void;
}

/** 驾驶舱指标卡：可下钻的指标提供点击入口，条数必须与下钻明细一致（FR-05 R5） */
export default function MetricCards({ metrics, loading, activeKey, onDrill }: Props) {
  return (
    <Row gutter={[12, 12]}>
      {metrics.map((m) => {
        const tone = TONE_VAR[m.tone ?? 'default'];
        const active = activeKey === m.key;
        return (
          <Col xs={12} sm={8} md={4} key={m.key}>
            <Tooltip title={m.drillable ? '点击下钻查看明细' : '概览指标，不支持下钻'}>
              <Card
                size="small"
                loading={loading}
                hoverable={m.drillable}
                onClick={() => m.drillable && onDrill(m.key)}
                style={{
                  position: 'relative',
                  cursor: m.drillable ? 'pointer' : 'default',
                  borderColor: active ? tone.border : undefined,
                  boxShadow: active ? `0 0 0 2px ${tone.bg}` : undefined,
                  background: m.drillable ? undefined : '#fcfcfc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Statistic
                    title={
                      <span style={{ fontSize: 13 }}>
                        {m.label}
                        {!m.drillable && <span style={{ color: '#ccc', fontWeight: 400 }}> ·概览</span>}
                      </span>
                    }
                    value={m.value}
                    suffix={m.suffix ? <span style={{ fontSize: 13, color: '#999' }}>{m.suffix}</span> : undefined}
                    valueStyle={{ color: tone.color, fontSize: 26, fontWeight: 600 }}
                  />
                  <span style={{ fontSize: 18, opacity: 0.5 }}>{GLYPH[m.key]}</span>
                </div>
                <Space size={4} style={{ marginTop: 6 }}>
                  <span style={{ color: '#999', fontSize: 12 }}>{m.caption}</span>
                </Space>
                {m.drillable && (
                  <div style={{ position: 'absolute', right: 12, bottom: 10, color: '#bbb', fontSize: 11 }}>下钻 ›</div>
                )}
              </Card>
            </Tooltip>
          </Col>
        );
      })}
    </Row>
  );
}
