/**
 * P1 登录页
 * 需求依据：5.2 P1 登录页、LOGIN-01（账号卡片）/ LOGIN-02（免密登录）
 * 无空态 / 错误态（预置账号必然可选）；账号列表优先取后端，接口异常时使用兜底列表保证可演示。
 */

import { useEffect, useState } from 'react';
import { App, Avatar, Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { fetchAccounts, fetchHealth, login } from '../services/api';
import { failureMessage } from '../services/http';
import { useAuthStore } from '../store/auth';
import type { User } from '../types';

/** 后端账号接口不可用时的兜底（预置 4 账号，需求 4.1） */
const FALLBACK_ACCOUNTS: User[] = [
  { id: 'leader01', name: '王负责人', role: 'leader' },
  { id: 'member01', name: '李成员', role: 'member' },
  { id: 'member02', name: '张成员', role: 'member' },
  { id: 'member03', name: '刘成员', role: 'member' },
];

const ROLE_LABEL: Record<string, string> = { member: '成员', leader: '负责人' };

export default function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [accounts, setAccounts] = useState<User[]>(FALLBACK_ACCOUNTS);
  const [selected, setSelected] = useState<string>('member01');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((state) => state.setAuth);
  const setWeek = useAuthStore((state) => state.setWeek);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  // 已登录直接进对应首页（避免重复登录）
  useEffect(() => {
    if (token !== null && user !== null) {
      navigate(user.role === 'leader' ? '/team/reports' : '/report/edit', { replace: true });
    }
  }, [token, user, navigate]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchAccounts();
        if (list.length > 0) setAccounts(list);
      } catch {
        // 保留兜底账号，登录页必须始终可用
      }
    })();
  }, []);

  const handleLogin = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await login(selected);
      setAuth(result.token, result.user);
      try {
        const health = await fetchHealth();
        setWeek(health.week);
      } catch {
        // 周次取不到时使用本地 ISO 周兜底
      }
      message.success(`欢迎，${result.user.name}`);
      navigate(result.user.role === 'leader' ? '/team/reports' : '/report/edit', { replace: true });
    } catch (error) {
      message.error(failureMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F7FA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: 720, borderRadius: 8 }}>
        <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center' }}>
          <Typography.Title level={2} style={{ marginBottom: 0, color: '#2F54EB' }}>
            AI 智能周报
          </Typography.Title>
          <Typography.Text type="secondary">
            随手写，AI 帮你出标准周报；负责人一键看全局
          </Typography.Text>
        </Space>

        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          {accounts.map((account) => {
            const active = account.id === selected;
            return (
              <Col span={12} key={account.id}>
                <Card
                  hoverable
                  onClick={() => setSelected(account.id)}
                  style={{
                    borderColor: active ? '#2F54EB' : '#F0F0F0',
                    borderWidth: active ? 2 : 1,
                    cursor: 'pointer',
                  }}
                  styles={{ body: { padding: 16 } }}
                >
                  <Space size={12}>
                    <Avatar style={{ backgroundColor: active ? '#2F54EB' : '#BFBFBF' }}>
                      {account.name.slice(0, 1)}
                    </Avatar>
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{account.name}</Typography.Text>
                      <Tag color={account.role === 'leader' ? 'blue' : 'default'}>
                        {ROLE_LABEL[account.role]}
                      </Tag>
                    </Space>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button type="primary" size="large" loading={loading} onClick={() => void handleLogin()}>
            登录
          </Button>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              演示环境免密登录，点击账号卡片选择身份
            </Typography.Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
