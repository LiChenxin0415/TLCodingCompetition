import { Alert, Input, InputNumber, Space } from 'antd';
import { useEffect, useState } from 'react';
import { CAP_NO_DELIVERABLE, SCORE_TIERS, validateScore } from '@/utils/rules';

interface Props {
  value?: number;
  hasDeliverable: boolean;
  onChange: (score: number, basis: string, forceReason?: string) => void;
}

/** 档位评分输入（FR-09 R1/R4：80–120、偏离 100 必填依据、无交付物封顶 95） */
export default function ScoreInput({ value, hasDeliverable, onChange }: Props) {
  const [score, setScore] = useState<number | null>(value ?? null);
  const [basis, setBasis] = useState('');
  const [force, setForce] = useState('');

  useEffect(() => {
    if (score === null) return;
    onChange(score, basis, force || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, basis, force]);

  const res = score === null ? null : validateScore({ score, hasDeliverable, basis, forceReason: force });

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Space>
        <InputNumber min={80} max={120} value={score} onChange={(v) => setScore(v ?? null)} placeholder="80–120" style={{ width: 120 }} />
        {score !== null && (
          <span style={{ color: '#888', fontSize: 12 }}>
            {SCORE_TIERS.find((t) => score >= t.min && score <= t.max)?.tier ?? '越界'}
          </span>
        )}
        {!hasDeliverable && <span style={{ color: '#d46b08', fontSize: 12 }}>交付物未上传</span>}
      </Space>
      <Input.TextArea
        rows={2}
        value={basis}
        onChange={(e) => setBasis(e.target.value)}
        placeholder={score !== null && score !== 100 ? '评分依据（必填）' : '评分依据（偏离 100 分时必填）'}
      />
      {res && res.needForce && res.level === 'error' && score !== null && score > CAP_NO_DELIVERABLE && (
        <>
          <Alert type="warning" showIcon message={res.message} />
          <Input
            value={force}
            onChange={(e) => setForce(e.target.value)}
            placeholder={`强制打分需填写理由（否则自动限制为 ${CAP_NO_DELIVERABLE} 分）`}
          />
        </>
      )}
      {res && res.level === 'error' && !res.needForce && <Alert type="error" showIcon message={res.message} />}
      {res && res.needForce && res.level === 'warn' && <Alert type="warning" showIcon message={res.message} />}
    </Space>
  );
}
