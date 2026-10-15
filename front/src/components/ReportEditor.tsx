import { Button, Input, Space, Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { FieldKey, ReportFields, TemplateField } from '@/types';

interface Props {
  value: ReportFields;
  onChange: (next: ReportFields) => void;
  fields: TemplateField[];
  disabled?: boolean;
}

const EMPTY: ReportFields = { weekDone: [], ongoing: [], issues: [], nextPlan: [] };

/**
 * 周报四字段编辑区（核心复用组件）
 * 被 P2 新建 / P3 详情回填 / P4 负责人代编辑 三处复用；逐字段独立编辑（GEN-08）
 */
export default function ReportEditor({ value, onChange, fields, disabled }: Props) {
  const data: ReportFields = { ...EMPTY, ...value };

  const setField = (key: FieldKey, items: string[]) => onChange({ ...data, [key]: items });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {fields.map((f) => {
        const items = data[f.key] ?? [];
        return (
          <div key={f.key}>
            <div className="section-label">
              {f.label}
              {f.required && <Typography.Text type="danger"> *</Typography.Text>}
              <Typography.Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
                （最多 {f.maxItems} 条，每条 ≤ {f.maxLen} 字）
              </Typography.Text>
            </div>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {items.map((item, idx) => (
                <Space key={idx} style={{ width: '100%' }} align="start">
                  <Input.TextArea
                    value={item}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    maxLength={f.maxLen}
                    showCount
                    disabled={disabled}
                    style={{ width: 520 }}
                    placeholder={`${f.label} ${idx + 1}`}
                    onChange={(e) =>
                      setField(
                        f.key,
                        items.map((v, i) => (i === idx ? e.target.value : v)),
                      )
                    }
                  />
                  {!disabled && (
                    <Button
                      type="text"
                      icon={<MinusCircleOutlined />}
                      onClick={() => setField(f.key, items.filter((_, i) => i !== idx))}
                    />
                  )}
                </Space>
              ))}
              {!disabled && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  disabled={items.length >= f.maxItems}
                  onClick={() => setField(f.key, [...items, ''])}
                >
                  添加一条
                </Button>
              )}
            </Space>
          </div>
        );
      })}
    </Space>
  );
}
