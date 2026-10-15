import { Button, Layout, Menu, Space, Tag, Tooltip } from 'antd';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { USE_MOCK } from '@/services/api';
import type { Role } from '@/types';

const { Header } = Layout;

interface MenuDef {
  key: string;
  label: string;
  roles: Role[];
}

/** HLD §4.1 页面可见角色 */
const MENUS: MenuDef[] = [
  { key: '/contracts/mine', label: '我的合约', roles: ['employee'] },
  { key: '/reports', label: '日报周报', roles: ['employee'] },
  { key: '/team/contracts', label: '组内合约', roles: ['leader'] },
  { key: '/dashboard', label: '部门看板', roles: ['leader', 'center'] },
  { key: '/objectives', label: '大目标管理', roles: ['leader', 'center'] },
  { key: '/calibration', label: '中心校准发布', roles: ['center'] },
  { key: '/history', label: '合约历史', roles: ['employee', 'leader', 'center'] },
  { key: '/skills', label: '能力画像', roles: ['employee', 'leader', 'center'] },
];

const ROLE_TEXT: Record<Role, string> = {
  employee: '员工',
  leader: '组长',
  center: '中心管理者',
};

export default function TopNav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const items = useMemo(
    () =>
      MENUS.filter((m) => user && m.roles.includes(user.role)).map((m) => ({
        key: m.key,
        label: m.label,
      })),
    [user],
  );

  if (!user) return null;

  return (
    <Header style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0 24px', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
      <div style={{ fontWeight: 700, fontSize: 17, marginRight: 24, whiteSpace: 'nowrap' }}>
        目标合约通
        <Tag color="blue" style={{ marginLeft: 8 }}>
          {ROLE_TEXT[user.role]}
        </Tag>
        {USE_MOCK && (
          <Tooltip title="当前走内置 Mock 适配器，不依赖后端">
            <Tag color="purple" style={{ marginLeft: 6 }}>
              Mock
            </Tag>
          </Tooltip>
        )}
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={[loc.pathname.split('/').slice(0, 3).join('/')]}
        items={items}
        onClick={({ key }) => nav(key)}
        style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
      />
      <Space size={8}>
        <span style={{ color: '#666' }}>{user.name}</span>
        <Button
          size="small"
          onClick={() => {
            logout();
            nav('/login');
          }}
        >
          切换身份
        </Button>
      </Space>
    </Header>
  );
}
