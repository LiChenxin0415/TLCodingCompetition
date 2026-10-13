/**
 * AI 生成按钮（含加载态 / 失败重试 / 降级入口）
 * 需求依据：GEN-01（空输入置灰）、GEN-04（加载态 + 20s 超时）、
 *           GEN-06（失败提示可重试）、GEN-07（连续 2 次失败提供模板填写模式）
 */

import { Alert, Button, Space, Typography } from 'antd';

interface Props {
  loading: boolean;
  disabled: boolean;
  /** 连续失败次数，≥2 时展示降级入口 */
  failedCount: number;
  onGenerate: () => void;
  onSwitchToManual: () => void;
}

export default function AIGenerateButton({
  loading,
  disabled,
  failedCount,
  onGenerate,
  onSwitchToManual,
}: Props): JSX.Element {
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space>
        <Button type="primary" loading={loading} disabled={disabled || loading} onClick={onGenerate}>
          {loading ? 'AI 正在整理你的周报…' : 'AI 生成'}
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          由后端调用大模型生成，最长等待 20 秒
        </Typography.Text>
      </Space>

      {failedCount >= 2 ? (
        <Alert
          type="warning"
          showIcon
          message="AI 生成连续失败"
          description={
            <Space direction="vertical" size={4}>
              <span>可继续重试，或切换为模板填写模式（不依赖 AI，功能完整可用）。</span>
              <Button size="small" onClick={onSwitchToManual}>
                切换为模板填写模式
              </Button>
            </Space>
          }
        />
      ) : null}
    </Space>
  );
}
