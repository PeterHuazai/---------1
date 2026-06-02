import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const PortalPage = lazy(() => import('./pages/PortalPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const CampusLifePage = lazy(() => import('./pages/CampusLifePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const StudyGroupsPage = lazy(() => import('./pages/StudyGroupsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ForumPage = lazy(() => import('./pages/ForumPage'));

function withSuspense(Component: ReactNode) {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>{Component}</Suspense>;
}

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: '登录', path: '/login', element: withSuspense(<LoginPage />), public: true },
  // 门户首页（公开，所有人可访问）
  { name: '门户', path: '/', element: withSuspense(<PortalPage />), public: true },
  // 论坛（公开可浏览，发帖回复需登录）
  { name: '论坛', path: '/forum', element: withSuspense(<ForumPage />), public: true },
  // 校园生活（公开可浏览，限制操作需登录）
  { name: '校园生活', path: '/campus', element: withSuspense(<CampusLifePage />), public: true },
  // 登录后控制台首页
  { name: '控制台', path: '/dashboard', element: withSuspense(<HomePage />) },
  { name: '课程表', path: '/courses', element: withSuspense(<CoursesPage />) },
  { name: '任务', path: '/tasks', element: withSuspense(<TasksPage />) },
  { name: '资料', path: '/materials', element: withSuspense(<MaterialsPage />) },
  { name: '打卡', path: '/goals', element: withSuspense(<GoalsPage />) },
  { name: '个人中心', path: '/profile', element: withSuspense(<ProfilePage />) },
  { name: '消息', path: '/notifications', element: withSuspense(<NotificationsPage />) },
  { name: '好友', path: '/friends', element: withSuspense(<FriendsPage />) },
  { name: '小组学习', path: '/study-groups', element: withSuspense(<StudyGroupsPage />) },
  { name: '管理后台', path: '/admin', element: withSuspense(<AdminPage />) },
];
