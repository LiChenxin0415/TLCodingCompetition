import { Alert, Button, Card, Col, Input, Row, Space, Tag, Tooltip, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { getSkills, hideSkill } from '@/services/api';
import { useAuth } from '@/store/auth';
import { db } from '@/services/seed';
import { toUserMessage } from '@/utils/error';
import type { Role, SkillTag } from '@/types';

export default function Skills() {
  const { user } = useAuth();
  const [target, setTarget] = useState(user?.role === 'employee' ? user?.id ?? '' : '');
  const [tags, setTags] = useState<SkillTag[]>([]);
  const [loading, setLoading] = useState(true);

  const candidates = db.users.filter((u) => u.role === 'employee');

  const load = async (uid: string) => {
    setLoading(true);
    try {
      setTags(await getSkills(uid));
    } catch (e) {
      message.error(toUserMessage(e));
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (target) void load(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    if (user?.role === 'employee') setTarget(user.id);
    else if (!target) setTarget(candidates[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const doHide = async (tagId: string) => {
    try {
      await hideSkill(tagId);
      message.success('已隐藏该标签');
      await load(target);
    } catch (e) {
      message.error(toUserMessage(e));
    }
  };

  const visible = tags.filter((t) => !t.hidden);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} className="page-title">
          个人能力画像
        </Typography.Title>
        {user && user.role !== ('employee' as Role) && (
          <Input.Search style={{ width: 220 }} placeholder="输入成员账号查看" enterButton="查询" onSearch={(v) => setTarget(v || target)} />
        )}
      </Space>

      <Alert type="warning" showIcon message="能力标签用于能力发展参考，不参与绩效计分（FR-08 R3/R6）" />

      <Card size="small" loading={loading}>
        {visible.length === 0 && !loading ? (
          <EmptyState description="暂无达到 2 分且带证据的能力标签" />
        ) : (
          <Row gutter={[12, 12]}>
            {visible.map((t) => (
              <Col xs={24} md={12} key={t.id}>
                <Card size="small" title={t.tag_name} extra={<Tag color="blue">{t.score} 分</Tag>}>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Tooltip title={t.evidence_item_ids.join(', ')}>
                      <span>证据工作包：{t.evidence_item_ids.length} 个</span>
                    </Tooltip>
                    <span style={{ color: '#999', fontSize: 12 }}>更新时间：{t.updated_at}</span>
                    {user?.id === target && (
                      <Button size="small" danger onClick={() => void doHide(t.id)}>
                        隐藏标签
                      </Button>
                    )}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </Space>
  );
}
