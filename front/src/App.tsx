import { ConfigProvider, Layout, Result } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import TopNav from '@/components/TopNav';
import { useAuth } from '@/store/auth';
import type { Role } from '@/types';
import Calibration from '@/pages/Calibration';
import Dashboard from '@/pages/Dashboard';
import History from '@/pages/History';
import ItemDetail from '@/pages/ItemDetail';
import Login from '@/pages/Login';
import MyContract from '@/pages/MyContract';
import Objectives from '@/pages/Objectives';
import Reports from '@/pages/Reports';
import Skills from '@/pages/Skills';
import TeamContracts from '@/pages/TeamContracts';

const { Content } = Layout;

/** 登录守卫 + 角色守卫（HLD §3：前端只做菜单隐藏，最终由后端 403 兜底） */
function Guard({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { token, user } = useAuth();
  const loc = useLocation();
  if (!token || !user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <Result
        status="403"
        title="无权限访问"
        subTitle="该页面仅对特定角色开放：权限由服务端行级校验兜底，前端仅做菜单隐藏。"
      />
    );
  }
  return (
    <>
      <TopNav />
      <Content>
        <div className="page">{children}</div>
      </Content>
    </>
  );
}

const HOME: Record<Role, string> = {
  employee: '/contracts/mine',
  leader: '/team/contracts',
  center: '/dashboard',
};

export default function App() {
  const { user } = useAuth();
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to={HOME[user.role]} replace /> : <Login />} />
          <Route
            path="/"
            element={
              <Guard>
                <Navigate to={user ? HOME[user.role] : '/login'} replace />
              </Guard>
            }
          />
          <Route path="/contracts/mine" element={<Guard roles={['employee']}><MyContract /></Guard>} />
          <Route path="/items/:id" element={<Guard roles={['employee', 'leader']}><ItemDetail /></Guard>} />
          <Route path="/team/contracts" element={<Guard roles={['leader']}><TeamContracts /></Guard>} />
          <Route path="/dashboard" element={<Guard roles={['leader', 'center']}><Dashboard /></Guard>} />
          <Route path="/objectives" element={<Guard roles={['leader', 'center']}><Objectives /></Guard>} />
          <Route path="/calibration" element={<Guard roles={['center']}><Calibration /></Guard>} />
          <Route path="/history" element={<Guard><History /></Guard>} />
          <Route path="/reports" element={<Guard roles={['employee']}><Reports /></Guard>} />
          <Route path="/skills" element={<Guard><Skills /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ConfigProvider>
  );
}
