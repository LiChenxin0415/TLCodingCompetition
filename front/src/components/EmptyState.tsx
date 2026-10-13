/**
 * 统一空态组件
 * 需求依据：UI 设计三态规范 —— 空态居中 Empty + 引导文案，禁止白屏
 */

import { Button, Empty, Space } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  description: ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({ description, actionText, onAction }: Props): JSX.Element {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={description}
      style={{ padding: '40px 0' }}
    >
      {actionText !== undefined && onAction !== undefined ? (
        <Space>
          <Button type="primary" onClick={onAction}>
            {actionText}
          </Button>
        </Space>
      ) : null}
    </Empty>
  );
}
