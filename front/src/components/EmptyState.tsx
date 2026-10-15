import { Empty, Typography } from 'antd';

interface Props {
  description: string;
  guide?: string;
}

/** 统一空态：禁止白屏（OVR-03 / 第七章） */
export default function EmptyState({ description, guide }: Props) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <Empty description={description} />
      {guide && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          {guide}
        </Typography.Text>
      )}
    </div>
  );
}
