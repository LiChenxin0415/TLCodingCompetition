/**
 * 路由与守卫 + 全局布局
 * 需求依据：frontend-design §4 页面与路由划分、LOGIN-03 / AUTH-03（未登录跳转）
 *           LEAD-01（负责人页面不可被成员访问，后端仍以 403 兜底）
 */

import { useEffect } from 'react';
import { App as AntdApp, Layout } from 'antd';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import TopNav from './components/TopNav';
import LoginPage from './pages/LoginPage';
import MyReportsPage from './pages/MyReportsPage';
import ReportEditPage from './pages/ReportEditPage';
import TeamOverviewPage from './pages/TeamOverviewPage';
import TeamReportsPage from './pages/TeamReportsPage';
import { fetchHealth } from './services/api';
import { useAuthStore } from './store/auth';

function AppLayout(): JSX.Element {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <TopNav />
      <Layout.Content style={{ padding: 24, background: '#F5F7FA' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Outlet />
        </div>
      </Layout.Content>
    </Layout>
  );
}

/** 未登录 → 跳登录页（LOGIN-03 / AUTH-03） */
function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (token === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/** 角色守卫：成员访问负责人页面 → 提示无权限并回到自己首页 */
function RequireLeader({ children }: { children: JSX.Element }): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const { message } = AntdApp.useApp();
  const forbidden = user === null || user.role !== 'leader';

  useEffect(() => {
    if (forbidden) message.error('无权限访问');
  }, [forbidden, message]);

  if (forbidden) {
    return <Navigate to="/report/edit" replace />;
  }
  return children;
}

/** 首页重定向：按角色进入各自首页 */
function HomeRedirect(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  if (user === null) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'leader' ? '/team/reports' : '/report/edit'} replace />;
}

export default function App(): JSX.Element {
  const token = useAuthStore((state) => state.token);
  const setWeek = useAuthStore((state) => state.setWeek);

  // 启动时同步服务端权威周次（GET /api/health）
  useEffect(() => {
    if (token === null) return;
    void (async () => {
      try {
        const health = await fetchHealth();
        setWeek(health.week);
      } catch {
        // 后端不可用时保留本地 ISO 周，页面继续可用
      }
    })();
  }, [setWeek, token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/report/edit" element={<ReportEditPage />} />
          <Route path="/my-reports" element={<MyReportsPage />} />
          <Route
            path="/team/reports"
            element={
              <RequireLeader>
                <TeamReportsPage />
              </RequireLeader>
            }
          />
          <Route
            path="/team/overview"
            element={
              <RequireLeader>
                <TeamOverviewPage />
              </RequireLeader>
            }
          />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
