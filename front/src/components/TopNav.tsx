/**
 * 顶部导航（常驻）：产品名 + 当前用户（姓名 + 角色标签）+「切换账号」
 * 需求依据：5.1 导航结构、LOGIN-04（切换账号）、第七章（离开前未保存确认）
 */

import { App, Button, Layout, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useEditorGuard } from '../store/editorGuard';

const ROLE_LABEL: Record<string, string> = { member: '成员', leader: '负责人' };

export default function TopNav(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { modal } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const dirty = useEditorGuard((state) => state.dirty);
  const setDirty = useEditorGuard((state) => state.setDirty);

  if (user === null) return <></>;

  const memberNav = [
    { key: '/report/edit', label: '编辑周报' },
    { key: '/my-reports', label: '我的周报' },
  ];
  const leaderNav = [
    { key: '/team/reports', label: '成员管理' },
    { key: '/team/overview', label: '团队总览' },
  ];
  const navItems = user.role === 'leader' ? leaderNav : memberNav;

  const confirmLeave = (action: () => void): void => {
    if (!dirty) {
      action();
      return;
    }
    modal.confirm({
      title: '未保存的修改将丢失',
      content: '当前编辑区还有未保存的内容，确认离开吗？',
      okText: '确认离开',
      cancelText: '继续编辑',
      onOk: () => {
        setDirty(false);
        action();
      },
    });
  };

  const go = (path: string): void => confirmLeave(() => navigate(path));

  const logout = (): void =>
    confirmLeave(() => {
      clearAuth();
      navigate('/login', { replace: true });
    });

  return (
    <Layout.Header
      style={{
        background: '#fff',
        borderBottom: '1px solid #F0F0F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      <Space size={28}>
        <Typography.Text strong style={{ fontSize: 16, color: '#2F54EB' }}>
          AI 智能周报
        </Typography.Text>
        <Space size={4}>
          {navItems.map((item) => {
            const active = location.pathname === item.key;
            return (
              <Button
                key={item.key}
                type={active ? 'primary' : 'text'}
                onClick={() => go(item.key)}
              >
                {item.label}
              </Button>
            );
          })}
        </Space>
      </Space>

      <Space size={12}>
        <Typography.Text>{user.name}</Typography.Text>
        <Tag color={user.role === 'leader' ? 'blue' : 'default'}>{ROLE_LABEL[user.role]}</Tag>
        <Button onClick={logout}>切换账号</Button>
      </Space>
    </Layout.Header>
  );
}
