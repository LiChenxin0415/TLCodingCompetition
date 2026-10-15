import { useEffect } from 'react';
import { App as AntApp, Layout } from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import TopNav from '@/components/TopNav';
import Login from '@/pages/Login';
import ReportEdit from '@/pages/ReportEdit';
import MyReports from '@/pages/MyReports';
import TeamReports from '@/pages/TeamReports';
import TeamOverview from '@/pages/TeamOverview';
import { useAuthStore } from '@/store/auth';
import { useTemplateStore } from '@/store/template';
import { HOME_BY_ROLE } from '@/utils/error';
import type { Role } from '@/types';

interface GuardProps {
  children: React.ReactNode;
  roles?: Role[];
}

/** 登录守卫 + 角色守卫（LOGIN-03 / AUTH-03）：后端仍会 403 兜底 */
function Guard({ children, roles }: GuardProps) {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();

  const denied = Boolean(roles && user && !roles.includes(user.role));
  const needLogin = !token || !user;

  useEffect(() => {
    if (needLogin) return;
    if (denied) {
      message.error('无权限访问');
      navigate(HOME_BY_ROLE[user!.role] ?? '/report/edit', { replace: true });
    }
  }, [denied, needLogin, message, navigate, user]);

  if (needLogin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (denied) return null;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[user.role] ?? '/report/edit'} replace />;
}

export default function App() {
  const { token } = useAuthStore();
  const loadTemplate = useTemplateStore((s) => s.load);

  useEffect(() => {
    if (token) void loadTemplate();
  }, [token, loadTemplate]);

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopNav />
      <Layout.Content>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/report/edit"
            element={
              <Guard>
                <ReportEdit />
              </Guard>
            }
          />
          <Route
            path="/my-reports"
            element={
              <Guard roles={['member']}>
                <MyReports />
              </Guard>
            }
          />
          <Route
            path="/team/reports"
            element={
              <Guard roles={['leader']}>
                <TeamReports />
              </Guard>
            }
          />
          <Route
            path="/team/overview"
            element={
              <Guard roles={['leader']}>
                <TeamOverview />
              </Guard>
            }
          />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}
