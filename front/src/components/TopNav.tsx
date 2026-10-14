import { App, Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useDirtyStore } from '@/store/dirty';
import { currentWeek } from '@/utils/isoWeek';

const MEMBER_ITEMS = [
  { key: '/report/edit', label: '写周报' },
  { key: '/my-reports', label: '我的周报' },
];

const LEADER_ITEMS = [
  { key: '/team/reports', label: '成员周报' },
  { key: '/team/overview', label: '团队总览' },
];

export default function TopNav() {
  const { user, logout } = useAuthStore();
  const dirty = useDirtyStore((s) => s.dirty);
  const setDirty = useDirtyStore((s) => s.setDirty);
  const navigate = useNavigate();
  const location = useLocation();
  const { modal } = App.useApp();

  if (!user) return null;

  const items = user.role === 'leader' ? LEADER_ITEMS : MEMBER_ITEMS;

  const switchAccount = () => {
    const doLogout = () => {
      logout();
      setDirty(false);
      navigate('/login', { replace: true });
    };
    if (dirty) {
      modal.confirm({
        title: '未保存的修改将丢失',
        content: '当前编辑内容尚未保存，切换账号后会丢失，是否继续？',
        okText: '继续切换',
        cancelText: '返回保存',
        onOk: doLogout,
      });
      return;
    }
    doLogout();
  };

  return (
    <Layout.Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, maxWidth: 1120, margin: '0 auto' }}>
        <Typography.Text strong style={{ fontSize: 16, color: '#2f54eb', whiteSpace: 'nowrap' }}>
          AI 智能周报
        </Typography.Text>
        <Menu
          mode="horizontal"
          items={items}
          selectedKeys={[location.pathname]}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
          onClick={(e) => navigate(e.key)}
        />
        <Space size={8}>
          <Typography.Text type="secondary">{currentWeek()}</Typography.Text>
          <Typography.Text>{user.name}</Typography.Text>
          <Tag color={user.role === 'leader' ? 'blue' : 'default'}>
            {user.role === 'leader' ? '负责人' : '成员'}
          </Tag>
          <Button size="small" onClick={switchAccount}>
            切换账号
          </Button>
        </Space>
      </div>
    </Layout.Header>
  );
}
