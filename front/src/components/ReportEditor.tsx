/**
 * 四字段编辑区（核心复用组件）
 * 需求依据：4.2 模板字段规范、5.3 P2 编辑区、GEN-08（逐字段独立编辑）
 * 复用位置：P2 新建 / P3 详情回填 / P4 负责人代编辑
 *
 * 说明：模板结构由 GET /api/template 下发（TPL-01），本组件只渲染，不硬编码字段。
 */

import { Input, Space, Tag, Typography } from 'antd';
import type { FieldKey, TemplateField } from '../types';
import { FIELD_MIN, textToItems } from '../utils/report';

interface Props {
  template: TemplateField[];
  value: Record<FieldKey, string>;
  onChange: (key: FieldKey, text: string) => void;
  disabled?: boolean;
}

export default function ReportEditor({ template, value, onChange, disabled = false }: Props): JSX.Element {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {template.map((field) => {
        const min = field.key === 'issues' ? 0 : FIELD_MIN[field.key];
        const count = textToItems(value[field.key] ?? '').length;
        const overflow = count > field.maxItems;
        return (
          <div key={field.key}>
            <Space size={8} style={{ marginBottom: 6 }}>
              <Typography.Text strong>{field.label}</Typography.Text>
              <Tag color={field.required ? 'red' : 'default'}>{field.required ? '必填' : '选填'}</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                每行一条 · {min}—{field.maxItems} 条 · 每条 ≤{field.maxLen} 字
              </Typography.Text>
              <Typography.Text type={overflow ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                当前 {count} 条
              </Typography.Text>
            </Space>
            <Input.TextArea
              value={value[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder={
                field.key === 'issues'
                  ? '每行一条；没有风险可填「暂无」'
                  : `每行一条，共 ${min}—${field.maxItems} 条`
              }
              autoSize={{ minRows: 3, maxRows: 8 }}
              disabled={disabled}
            />
          </div>
        );
      })}
    </Space>
  );
}
