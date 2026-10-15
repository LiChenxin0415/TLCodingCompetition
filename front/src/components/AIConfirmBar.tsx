import { Alert, Button, InputNumber, Space, Tag } from 'antd';
import { useState } from 'react';
import type { ProgressParseResult } from '@/types';

interface Props {
  result: ProgressParseResult;
  /** 当前选中工作包的原始文本 */
  rawText: string;
  onAdopt: (payload: { item_id: string; new_progress: number; delta: number }) => void;
  onReject: () => void;
}

/**
 * AI 确认条（FR-01 R3/R4）：
 * - confidence ≥ 0.6 → 给出结论「识别为「X」→ Y%（±Z%）」
 * - confidence < 0.6 / no_signal → 只给候选列表由用户点选
 */
export default function AIConfirmBar({ result, rawText, onAdopt, onReject }: Props) {
  const [manual, setManual] = useState<number | null>(null);

  const confirmText = `识别为「${result.item_title}」→ ${result.new_progress}%（${
    result.delta >= 0 ? '+' : ''
  }${result.delta}%），是否采纳？`;

  return (
    <Alert
      type={result.no_signal ? 'warning' : 'info'}
      style={{ marginBottom: 12 }}
      icon={<Tag className="ai-badge">AI</Tag>}
      message={
        <div>
          {result.no_signal && <div style={{ marginBottom: 8 }}>未识别到明确进展，请手动输入进度或补充更具体的描述。</div>}
          {!result.no_signal && result.item_id && result.confidence >= 0.6 && (
            <div style={{ marginBottom: 8 }}>
              {confirmText}
              <span style={{ color: '#999', marginLeft: 8 }}>置信度 {result.confidence}</span>
            </div>
          )}
          {result.confidence < 0.6 && (
            <div style={{ marginBottom: 8 }}>
              未能确定归属工作包（最高置信度 {result.confidence} &lt; 0.6），请选择对应的工作包：
              <Space wrap style={{ marginTop: 6 }}>
                {result.candidates.map((c) => (
                  <Button
                    key={c.item_id}
                    size="small"
                    onClick={() => onAdopt({ item_id: c.item_id, new_progress: result.new_progress, delta: result.delta })}
                  >
                    {c.item_title}（{Math.round(c.confidence * 100)}%）
                  </Button>
                ))}
              </Space>
            </div>
          )}
          <div style={{ color: '#888', fontSize: 12 }}>
            原文：{rawText}
            {result.evidence ? ` ｜ 抽取证据：${result.evidence}` : ''}
          </div>
          {result.suggest_deliverable && (
            <div style={{ marginTop: 6, color: '#d46b08' }}>
              检测到「完成/验收通过」语义，建议同时上传交付物（FR-03）。
            </div>
          )}
          <Space style={{ marginTop: 8 }}>
            {result.item_id && result.confidence >= 0.6 && (
              <Button
                type="primary"
                size="small"
                onClick={() =>
                  result.item_id &&
                  onAdopt({ item_id: result.item_id, new_progress: result.new_progress, delta: result.delta })
                }
              >
                采纳
              </Button>
            )}
            <Button size="small" onClick={onReject}>
              不采纳
            </Button>
            <Space.Compact size="small">
              <InputNumber min={0} max={100} value={manual} onChange={(v) => setManual(v ?? null)} placeholder="手工进度" style={{ width: 100 }} />
              <Button
                onClick={() =>
                  result.item_id && manual !== null && onAdopt({ item_id: result.item_id, new_progress: manual, delta: manual - (result.new_progress - result.delta) })
                }
                disabled={manual === null || !result.item_id}
              >
                手工写入
              </Button>
            </Space.Compact>
          </Space>
        </div>
      }
    />
  );
}
