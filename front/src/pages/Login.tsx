import { Alert, Card, Col, Row, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/services/api';
import { DEMO_ACCOUNTS } from '@/services/seed';
import { useAuth } from '@/store/auth';
import { toUserMessage } from '@/utils/error';
import type { Role } from '@/types';

const ROLE_TEXT: Record<Role, string> = { employee: '员工', leader: '组长', center: '中心管理者' };
const ROLE_DESC: Record<Role, string> = {
  employee: '定合约 · 报进度 · 传交付物',
  leader: '核对合约 · 月中调整 · 月末评分',
  center: '部门看板 · 组间校准 · 确认发布',
};

export default function Login() {
  const nav = useNavigate();
  const { login: saveAuth } = useAuth();
  const [loading, setLoading] = useState('');
  const [err, setErr] = useState('');

  const doLogin = async (userId: string) => {
    setLoading(userId);
    setErr('');
    try {
      const res = await login(userId);
      saveAuth(res.token, res.user);
      nav(res.user.role === 'employee' ? '/contracts/mine' : res.user.role === 'leader' ? '/team/contracts' : '/dashboard', { replace: true });
    } catch (e) {
      setErr(toUserMessage(e));
    } finally {
      setLoading('');
    }
  };

  const byRole = (role: Role) => DEMO_ACCOUNTS.filter((a) => a.role === role);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px' }}>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        目标合约通
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        科技部门目标逐级拆解与验证闭环系统 · 演示环境免密登录，选择身份即可进入
      </Typography.Paragraph>
      {err && <Alert type="error" message={err} style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]}>
        {(['employee', 'leader', 'center'] as Role[]).map((role) => (
          <Col xs={24} md={8} key={role}>
            <Card title={`${ROLE_TEXT[role]}（${byRole(role).length}）`} extra={<Tag color="blue">{ROLE_DESC[role]}</Tag>}>
              {byRole(role).map((a) => (
                <Card
                  key={a.id}
                  size="small"
                  hoverable
                  style={{ marginBottom: 8 }}
                  onClick={() => doLogin(a.id)}
                >
                  <b>{a.name}</b>
                  <span style={{ color: '#999', marginLeft: 8 }}>{a.group_name}</span>
                  <div style={{ color: '#bbb', fontSize: 12 }}>{loading === a.id ? '登录中…' : `账号 ${a.id}`}</div>
                </Card>
              ))}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
