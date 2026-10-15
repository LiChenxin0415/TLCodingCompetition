import { Empty } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  description: string;
  extra?: ReactNode;
  image?: ReactNode;
}

/** 空态（PRD §12 异常与空状态） */
export default function EmptyState({ description, extra }: Props) {
  return (
    <div style={{ padding: '32px 0', background: '#fff', borderRadius: 8 }}>
      <Empty description={description}>{extra}</Empty>
    </div>
  );
}
