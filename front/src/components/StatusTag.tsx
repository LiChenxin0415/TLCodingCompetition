/**
 * 提交状态标签：草稿 / 已提交 / 未开始
 * 需求依据：4.4 状态机、4.6.1 提交状态（含「未开始」）
 */

import { Tag } from 'antd';
import type { ReportStatus } from '../types';

interface Props {
  status?: ReportStatus | null;
}

export default function StatusTag({ status }: Props): JSX.Element {
  if (status === undefined || status === null) {
    return <Tag>未开始</Tag>;
  }
  if (status === 'submitted') {
    return <Tag color="success">已提交</Tag>;
  }
  return <Tag color="default">草稿</Tag>;
}
