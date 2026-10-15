import { Tooltip } from 'antd';

export interface ProgressBarProps {
  value: number;
  /** 高度，默认 8 */
  height?: number;
  /** 是否渐变（>=100 自动转完成色） */
  showText?: boolean;
  color?: string;
}

const done = (v: number) => v >= 100;
const riskColor = (v: number) => (done(v) ? '#52c41a' : v >= 60 ? '#1677ff' : v >= 30 ? '#faad14' : '#ff7875');

/** 统一进度条：看板、下钻、大目标卡片共用 */
export default function ProgressBar({ value, height = 8, showText = false, color }: ProgressBarProps) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  const fill = done(v) ? '#52c41a' : (color ?? riskColor(v));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Tooltip title={`${v}%`}>
        <div
          style={{
            flex: 1,
            minWidth: 40,
            background: '#f0f0f0',
            height,
            borderRadius: height / 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${v}%`,
              height: '100%',
              borderRadius: height / 2,
              background: fill,
              transition: 'width .3s ease',
            }}
          />
        </div>
      </Tooltip>
      {showText && (
        <span className="mono" style={{ fontSize: 12, color: '#666', flexShrink: 0, width: 42, textAlign: 'right' }}>
          {v}%
        </span>
      )}
    </div>
  );
}
