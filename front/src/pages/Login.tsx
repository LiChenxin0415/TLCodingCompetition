import { useState } from 'react';
import { App, Button, Card, Col, Row, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { login } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { HOME_BY_ROLE, toUserMessage } from '@/utils/error';
import type { User } from '@/types';

/** 预置账号（需求 4.1 / demo-data-seed-v1.md） */
const ACCOUNTS: User[] = [
  { id: 'leader01', name: '王负责人', role: 'leader' },
  { id: 'member01', name: '李成员', role: 'member' },
  { id: 'member02', name: '张成员', role: 'member' },
  { id: 'member03', name: '刘成员', role: 'member' },
];

/** P1 登录页：4 个预置账号卡片，点击选中高亮，免密登录（LOGIN-01/02） */
export default function Login() {
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { message } = App.useApp();
  const token = useAuthStore((s) => s.token);

  const handleLogin = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await login(selected);
      setAuth(res.token, res.user);
      navigate(HOME_BY_ROLE[res.user.role] ?? '/report/edit', { replace: true });
    } catch (err) {
      message.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: 720 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            AI 智能周报系统
          </Typography.Title>
          <Typography.Text type="secondary">随手写下本周做了什么，AI 帮你整理成标准周报</Typography.Text>
        </div>
        <Row gutter={[16, 16]}>
          {ACCOUNTS.map((u) => {
            const active = selected === u.id;
            return (
              <Col span={12} key={u.id}>
                <Card
                  hoverable
                  onClick={() => setSelected(u.id)}
                  style={{
                    borderColor: active ? '#2f54eb' : undefined,
                    boxShadow: active ? '0 0 0 2px rgba(47,84,235,0.15)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#f0f3ff',
                        color: '#2f54eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                      }}
                    >
                      {u.name.slice(0, 1)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Typography.Text strong>{u.name}</Typography.Text>
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {u.id}
                        </Typography.Text>
                      </div>
                    </div>
                    <Tag color={u.role === 'leader' ? 'blue' : 'default'}>
                      {u.role === 'leader' ? '负责人' : '成员'}
                    </Tag>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
        <Button
          type="primary"
          size="large"
          block
          style={{ marginTop: 24 }}
          disabled={!selected}
          loading={loading}
          onClick={handleLogin}
        >
          {selected ? '登录' : '请选择要登录的账号'}
        </Button>
        {token && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12, textAlign: 'center' }}>
            已登录可直接从顶部导航切换账号
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
