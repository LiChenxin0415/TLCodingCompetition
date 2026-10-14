import { useState } from 'react';
import { App, Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { generateReport } from '@/services/api';
import { toUserMessage } from '@/utils/error';
import type { ReportFields } from '@/types';

interface Props {
  input: string;
  /** 编辑区已有内容时，生成前弹覆盖确认（GEN-05） */
  hasContent: boolean;
  onResult: (fields: ReportFields) => void;
  /** 连续 2 次失败 → 通知父组件切换降级模式（GEN-07） */
  onDegrade: () => void;
  disabled?: boolean;
}

export default function AIGenerateButton({ input, hasContent, onResult, onDegrade, disabled }: Props) {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);

  const empty = !input.trim();

  const doGenerate = async () => {
    setLoading(true);
    try {
      const fields = await generateReport(input);
      setFailCount(0);
      onResult(fields);
      message.success('已生成，请检查并编辑');
    } catch (err) {
      message.error(toUserMessage(err));
      const next = failCount + 1;
      setFailCount(next);
      if (next >= 2) onDegrade();
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (!hasContent) {
      void doGenerate();
      return;
    }
    modal.confirm({
      title: '重新生成将覆盖当前内容',
      content: '编辑区已有内容，生成后会被覆盖，是否继续？',
      okText: '继续生成',
      cancelText: '取消',
      onOk: doGenerate,
    });
  };

  return (
    <Button
      type="primary"
      icon={<ThunderboltOutlined />}
      loading={loading}
      disabled={disabled || empty || loading}
      onClick={handleClick}
      title={empty ? '请先写下本周工作内容' : ''}
    >
      {loading ? 'AI 正在整理你的周报…' : 'AI 生成周报'}
    </Button>
  );
}
