import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, BookOpen, ClipboardList, FolderOpen,
  Target, Bell, LogOut, Menu, X, ShieldCheck,
  ChevronDown, User, Users, Newspaper, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/db/supabase';
import ContactAdminWidget from '@/components/ContactAdminWidget';
import LoginPromptModal from '@/components/LoginPromptModal';

// 导航项：图标 + 名称 + 路径 + 是否公开可用
const navItems = [
  { name: '首页', path: '/', icon: Newspaper, publicOk: true },
  { name: '校园生活', path: '/campus', icon: BookOpen, publicOk: true },
  { name: '论坛', path: '/forum', icon: MessageSquare, publicOk: true },
  { name: '控制台', path: '/dashboard', icon: LayoutDashboard, publicOk: false },
  { name: '课程表', path: '/courses', icon: ClipboardList, publicOk: false },
  { name: '任务', path: '/tasks', icon: ClipboardList, publicOk: false },
  { name: '资料', path: '/materials', icon: FolderOpen, publicOk: false },
  { name: '打卡', path: '/goals', icon: Target, publicOk: false },
  { name: '好友', path: '/friends', icon: Users, publicOk: false },
  { name: '小组学习', path: '/study-groups', icon: Users, publicOk: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loginPrompt, setLoginPrompt] = useState(false);

  // 顶部显示的主导航（最多5项，其余放入"更多"）
  const visibleItems = navItems.filter(item => user || item.publicOk);
  const primaryNav = visibleItems.slice(0, 5);
  const moreNav = visibleItems.slice(5);

  // 滚动阴影
  useEffect(() => {
    const el = document.getElementById('main-scroll');
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || '用户';

  return (
    <div className="min-h-screen bg-[#F0F2F7] flex flex-col">
      {/* ── 顶部导航栏 ── */}
      <header className={`sticky top-0 z-40 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-md' : 'shadow-sm'}`}>
        {/* 主导航行 */}
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-16 flex items-center gap-6">
          {/* Logo — 始终回到门户首页 */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-[#165DFF] rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 hidden sm:block">大学生学习平台</span>
          </button>

          {/* 桌面导航链接 — 最多显示5项，余下折叠到"更多" */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {primaryNav.map((item) => {
              const active = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-[#165DFF] bg-[#165DFF]/8'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.name}
                </button>
              );
            })}
            {/* 更多下拉菜单 */}
            {moreNav.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMoreMenuOpen(v => !v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    moreNav.some(i => location.pathname.startsWith(i.path))
                      ? 'text-[#165DFF] bg-[#165DFF]/8'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  更多
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {moreMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-[#E5E6EB] py-1.5 z-50">
                      {moreNav.map(item => {
                        const active = location.pathname.startsWith(item.path);
                        return (
                          <button
                            key={item.path}
                            onClick={() => { navigate(item.path); setMoreMenuOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                              active ? 'text-[#165DFF] bg-[#165DFF]/5' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <item.icon className="w-3.5 h-3.5 shrink-0" />
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* 管理后台（admin / superadmin 可见） */}
            {profile && ['admin', 'superadmin'].includes(profile.role) && (
              <button
                onClick={() => navigate('/admin')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith('/admin')
                    ? 'text-[#FF7D00] bg-[#FF7D00]/8'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />管理后台
              </button>
            )}
          </nav>

          <div className="flex-1 md:hidden" />

          {/* 右侧操作区 */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <>
                {/* 通知铃 */}
                <button
                  onClick={() => navigate('/notifications')}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-[#FF7D00] text-white text-[10px] font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* 用户菜单 */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(v => !v)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile?.avatar_url || undefined} alt="头像" className="object-cover" />
                      <AvatarFallback className="bg-[#165DFF] text-white text-xs font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[88px] truncate">{displayName}</span>
                    <ChevronDown className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* 下拉菜单 */}
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-[#E5E6EB] py-1.5 z-50">
                        <div className="px-4 py-2.5 border-b border-[#E5E6EB]">
                          <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{profile?.email || ''}</p>
                        </div>
                        <button
                          onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <User className="w-4 h-4 text-gray-400" />个人资料
                        </button>
                        {profile && ['admin', 'superadmin'].includes(profile.role) && (
                          <button
                            onClick={() => { setUserMenuOpen(false); navigate('/admin'); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#FF7D00] hover:bg-[#FF7D00]/5"
                          >
                            <ShieldCheck className="w-4 h-4" />管理后台
                          </button>
                        )}
                        <div className="border-t border-[#E5E6EB] mt-1 pt-1">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                          >
                            <LogOut className="w-4 h-4" />退出登录
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* 未登录：显示登录/注册按钮 → 弹出登录提示弹窗 */
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" onClick={() => setLoginPrompt(true)}
                  className="h-9 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl">
                  登录
                </Button>
                <Button onClick={() => setLoginPrompt(true)}
                  className="h-9 px-5 text-sm font-medium bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-xl">
                  免费注册
                </Button>
              </div>
            )}

            {/* 移动端汉堡菜单按钮 */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 桌面端二级导航下划线指示器 */}
        <div className="hidden md:block border-b border-[#E5E6EB]" />
      </header>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E6EB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#165DFF] rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-gray-900">大学生学习平台</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
              {visibleItems.map((item) => {
                const active = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      active ? 'bg-[#165DFF]/10 text-[#165DFF]' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.name}
                  </button>
                );
              })}
              {profile && ['admin', 'superadmin'].includes(profile.role) && (
                <button
                  onClick={() => { navigate('/admin'); setMobileOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-[#FF7D00]/10 text-[#FF7D00]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />管理后台
                </button>
              )}
            </nav>
            {/* 移动端用户区 */}
            <div className="border-t border-[#E5E6EB] p-4 space-y-2">
              {user ? (
                <>
                  <button
                    onClick={() => { navigate('/profile'); setMobileOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-[#165DFF] text-white text-xs font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium truncate">{displayName}</p>
                      <p className="text-xs text-gray-400">个人资料</p>
                    </div>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />退出登录
                  </button>
                </>
              ) : (
                <>
                  <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-xl"
                    onClick={() => { setMobileOpen(false); setLoginPrompt(true); }}>
                    登录 / 免费注册
                  </Button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* 主内容区 */}
      <main id="main-scroll" className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
          {children}
        </div>
      </main>

      {/* 联系管理员悬浮窗 */}
      <ContactAdminWidget />

      {/* 登录提示弹窗（未登录用户点击功能时触发） */}
      <LoginPromptModal
        open={loginPrompt}
        onClose={() => setLoginPrompt(false)}
      />
    </div>
  );
}
