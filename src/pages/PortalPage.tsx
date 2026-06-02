import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CampusNews, ClubActivity, SecondHand, LostFound } from '@/types/types';
import {
  Search, BookOpen, Target, Building2, Bell, ChevronRight,
  Users, Megaphone, ShoppingBag, MapPinOff, ArrowRight,
  GraduationCap, Calendar, Tag, Clock, Eye, DoorOpen, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ContactAdminWidget from '@/components/ContactAdminWidget';
import LoginPromptModal from '@/components/LoginPromptModal';

// ─────────────────── 顶部公共导航（门户专用） ───────────────────
function PortalNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    signOut().then(() => { navigate('/'); });
    setMobileOpen(false);
  };

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // 门户专属锚点链接
  const portalLinks = [
    { label: '首页', href: '/', isAnchor: true },
    { label: '校园资讯', href: '#news', isAnchor: true },
    { label: '社团活动', href: '#activities', isAnchor: true },
    { label: '二手交易', href: '#secondhand', isAnchor: true },
    { label: '失物招领', href: '#lostfound', isAnchor: true },
    { label: '论坛', href: '/forum', isAnchor: false },
  ];

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-[1300px] mx-auto px-6 h-16 flex items-center gap-4">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 shrink-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${scrolled ? 'bg-[#165DFF]' : 'bg-white/20 backdrop-blur-sm'}`}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className={`text-lg font-bold hidden sm:block ${scrolled ? 'text-gray-900' : 'text-white'}`}>大学生学习平台</span>
          </button>

          {/* 桌面导航链接 */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {portalLinks.map(({ label, href, isAnchor }) => (
              isAnchor ? (
                <a key={label} href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scrolled
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}>
                  {label}
                </a>
              ) : (
                <button key={label} onClick={() => navigate(href)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scrolled
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}>
                  {label}
                </button>
              )
            ))}
            {/* 已登录额外入口 */}
            {user && (
              <button
                onClick={() => navigate('/campus')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  scrolled
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                校园生活
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
            {/* 右侧按钮 */}
            {user ? (
              <Button
                onClick={() => navigate('/dashboard')}
                className={`h-9 px-4 text-sm font-medium rounded-xl hidden md:flex ${
                  scrolled
                    ? 'bg-[#165DFF] text-white hover:bg-[#165DFF]/90'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border border-white/30'
                }`}
              >
                进入控制台
              </Button>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/login')}
                  className={`h-9 px-4 text-sm font-medium rounded-xl ${
                    scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'
                  }`}
                >
                  登录
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  className={`h-9 px-5 text-sm font-medium rounded-xl ${
                    scrolled
                      ? 'bg-[#165DFF] text-white hover:bg-[#165DFF]/90'
                      : 'bg-white text-[#165DFF] hover:bg-white/90'
                  }`}
                >
                  免费注册
                </Button>
              </div>
            )}

            {/* 移动端汉堡菜单 */}
            <button
              className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-white/10 text-white'}`}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 移动端菜单 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E6EB]">
              <span className="font-bold text-gray-900">大学生学习平台</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-3 space-y-0.5">
              {portalLinks.map(({ label, href, isAnchor }) => (
                isAnchor ? (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {label}
                  </a>
                ) : (
                  <button
                    key={label}
                    onClick={() => { navigate(href); setMobileOpen(false); }}
                    className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {label}
                  </button>
                )
              ))}
              {user && (
                <button
                  onClick={() => { navigate('/campus'); setMobileOpen(false); }}
                  className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  校园生活
                </button>
              )}
            </nav>
            <div className="border-t border-[#E5E6EB] p-4">
              {user ? (
                <div className="space-y-2">
                  <Button onClick={() => { navigate('/dashboard'); setMobileOpen(false); }}
                    className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-xl">
                    进入控制台
                  </Button>
                  <Button variant="outline" type="button"
                    onClick={handleLogout}
                    className="w-full rounded-xl">
                    退出登录
                  </Button>
                </div>
              ) : (
                <Button onClick={() => { navigate('/login'); setMobileOpen(false); }}
                  className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-xl">
                  登录 / 免费注册
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ─────────────────── 主门户页面 ───────────────────
export default function PortalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [news, setNews] = useState<CampusNews[]>([]);
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [secondhand, setSecondhand] = useState<SecondHand[]>([]);
  const [lostfound, setLostfound] = useState<LostFound[]>([]);
  const [stats, setStats] = useState({ news: 0, activities: 0, secondhand: 0, lostfound: 0 });
  const [loginPrompt, setLoginPrompt] = useState<{ open: boolean; action?: string; path?: string }>({ open: false });

  // 需要登录才能访问的路径
  const requireLogin = (path: string, label: string) => {
    if (user) { navigate(path); }
    else { setLoginPrompt({ open: true, action: label, path }); }
  };

  useEffect(() => {
    const fetchAll = async () => {
      const [
        { data: newsData, count: newsCount },
        { data: actData, count: actCount },
        { data: shData, count: shCount },
        { data: lfData, count: lfCount },
      ] = await Promise.all([
        supabase.from('campus_news').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(6),
        supabase.from('club_activities').select('*', { count: 'exact' }).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(6),
        supabase.from('second_hand').select('*', { count: 'exact' }).eq('status', 'available').eq('is_deleted', false).order('created_at', { ascending: false }).limit(6),
        supabase.from('lost_found').select('*', { count: 'exact' }).eq('status', 'open').eq('is_deleted', false).order('created_at', { ascending: false }).limit(4),
      ]);
      setNews(newsData || []);
      setActivities(actData || []);
      setSecondhand(shData || []);
      setLostfound(lfData || []);
      setStats({ news: newsCount || 0, activities: actCount || 0, secondhand: shCount || 0, lostfound: lfCount || 0 });
    };
    fetchAll();
  }, []);

  const hotTags = [
    { label: '校园活动', path: '/campus?tab=activities', needLogin: false },
    { label: '选课指南', path: '/forum?cat=course', needLogin: false },
    { label: '四六级备考', path: '/forum?cat=cet', needLogin: false },
    { label: '考研资料', path: '/forum?cat=postgrad', needLogin: false },
    { label: '二手教材', path: '/campus?tab=secondhand', needLogin: false },
    { label: '失物招领', path: '/campus?tab=lostfound', needLogin: false },
    { label: '社团招新', path: '/campus?tab=activities', needLogin: false },
    { label: '实习分享', path: '/forum?cat=internship', needLogin: false },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/campus?search=${encodeURIComponent(searchQuery)}`);
  };

  const goToCampus = (tab?: string) => {
    navigate(tab ? `/campus?tab=${tab}` : '/campus');
  };

  return (
    <div className="min-h-screen bg-[#F0F2F7]">
      <PortalNav />

      {/* ═══════════════════════════════════════════════════════════
          1. HERO 横幅 — 全屏背景 + 搜索
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[600px] flex items-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0d2b8a 0%, #165DFF 50%, #1e86ff 100%)',
        }}>
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[600px] h-[600px] rounded-full bg-white/5" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-white/3" />
        </div>
        {/* 右侧装饰图 */}
        <div className="absolute right-0 top-0 bottom-0 w-[45%] hidden lg:block overflow-hidden">
          <img
            src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_3f3faec0-5f3c-4d20-a388-e5e19c16428b.jpg"
            alt="校园风光"
            className="w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #165DFF 0%, transparent 50%)' }} />
        </div>

        <div className="relative z-10 max-w-[1300px] mx-auto px-6 pt-20 pb-16 w-full">
          <div className="max-w-2xl">
            {/* 副标题 */}
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-white/20 text-white border-0 text-xs px-3 py-1">大学生一站式服务平台</Badge>
              <Badge className="bg-[#FF7D00]/80 text-white border-0 text-xs px-3 py-1">全新上线</Badge>
            </div>
            {/* 主标题 */}
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-3 text-balance">
              校园信息<br />尽在掌握
            </h1>
            <p className="text-white/80 text-lg mb-8 leading-relaxed text-pretty">
              覆盖课程管理、学习打卡、社团活动、二手交易、失物招领等全方位校园服务，
              <span className="text-white font-medium">让大学生活更高效、更精彩</span>
            </p>

            {/* 搜索框 */}
            <form onSubmit={handleSearch} className="flex gap-3 mb-6 max-w-xl">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索校园资讯、活动、二手物品..."
                  className="h-13 pl-12 pr-4 text-base rounded-xl border-0 shadow-lg bg-white"
                  style={{ height: '52px' }}
                />
              </div>
              <Button type="submit" className="h-[52px] px-7 bg-[#FF7D00] hover:bg-[#FF7D00]/90 text-white font-semibold rounded-xl text-base shadow-lg">
                搜索
              </Button>
            </form>

            {/* 热门标签 */}
            <div className="flex flex-wrap gap-2">
              {hotTags.map(({ label, path, needLogin }) => (
                <button key={label} onClick={() => needLogin ? requireLogin(path, label) : navigate(path)}
                  className="px-3 py-1.5 rounded-full text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors border border-white/20">
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          2. 数据统计横幅
      ═══════════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-[#E5E6EB] shadow-sm">
        <div className="max-w-[1300px] mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Megaphone, label: '校园资讯', value: stats.news, unit: '条', color: 'text-[#165DFF]', bg: 'bg-[#165DFF]/10' },
              { icon: Users, label: '社团活动', value: stats.activities, unit: '个招募中', color: 'text-green-600', bg: 'bg-green-50' },
              { icon: ShoppingBag, label: '二手在售', value: stats.secondhand, unit: '件', color: 'text-[#FF7D00]', bg: 'bg-orange-50' },
              { icon: MapPinOff, label: '失物寻找', value: stats.lostfound, unit: '条', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(({ icon: Icon, label, value, unit, color, bg }) => (
              <div key={label} className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg} shrink-0`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm font-normal ml-1 text-gray-500">{unit}</span></p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          3. 功能入口矩阵
      ═══════════════════════════════════════════════════════════ */}
      <section className="max-w-[1300px] mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">平台核心功能</h2>
          <p className="text-gray-500 mt-2">覆盖大学生学习与生活的每一个场景</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: BookOpen, label: '课程管理', desc: '课表导入、提醒通知', color: 'text-[#165DFF]', bg: 'bg-[#165DFF]/10', path: '/courses', needLogin: true, badge: '登录使用' },
            { icon: Target, label: '学习打卡', desc: '热力日历、连续记录', color: 'text-orange-500', bg: 'bg-orange-50', path: '/goals', needLogin: true, badge: '登录使用' },
            { icon: Bell, label: '任务提醒', desc: '截止预警、待办管理', color: 'text-purple-600', bg: 'bg-purple-50', path: '/tasks', needLogin: true, badge: '登录使用' },
            { icon: Building2, label: '校园生活', desc: '活动、交易、资讯', color: 'text-green-600', bg: 'bg-green-50', path: '/campus', needLogin: false, badge: '免费浏览' },
            { icon: DoorOpen, label: '空教室查询', desc: '实时查询空余教室', color: 'text-cyan-600', bg: 'bg-cyan-50', path: '/campus?tab=classrooms', needLogin: false, badge: '免费浏览' },
            { icon: ShoppingBag, label: '二手交易', desc: '闲置物品买卖平台', color: 'text-[#FF7D00]', bg: 'bg-orange-50', path: '/campus?tab=secondhand', needLogin: false, badge: '免费浏览' },
            { icon: MapPinOff, label: '失物招领', desc: '快速找到失散物品', color: 'text-red-500', bg: 'bg-red-50', path: '/campus?tab=lostfound', needLogin: false, badge: '免费浏览' },
            { icon: Users, label: '社团活动', desc: '精彩活动报名参与', color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/campus?tab=activities', needLogin: false, badge: '免费浏览' },
          ].map(({ icon: Icon, label, desc, color, bg, path, needLogin, badge }) => (
            <button key={label} onClick={() => needLogin ? requireLogin(path, label) : navigate(path)}
              className="bg-white rounded-2xl border border-[#E5E6EB] p-5 text-left hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <p className="font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-400 mt-1">{desc}</p>
              <Badge className={`mt-2 text-[10px] ${badge === '免费浏览' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 text-[#165DFF] border-blue-200'} border`}>{badge}</Badge>
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          4. 校园资讯
      ═══════════════════════════════════════════════════════════ */}
      <section id="news" className="max-w-[1300px] mx-auto px-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-[#165DFF]" />校园资讯
            </h2>
            <p className="text-gray-500 text-sm mt-1">最新校园动态，实时掌握</p>
          </div>
          <Button variant="outline" onClick={() => goToCampus('news')} className="gap-1.5 text-sm">
            查看全部<ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {news.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-[#E5E6EB]">暂无资讯</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {news.map((item, idx) => (
              <button key={item.id} onClick={() => goToCampus('news')}
                className="bg-white rounded-2xl border border-[#E5E6EB] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                {idx === 0 && (
                  <div className="h-44 overflow-hidden bg-gradient-to-br from-[#165DFF]/20 to-[#36a3ff]/20 flex items-center justify-center">
                    <Megaphone className="w-16 h-16 text-[#165DFF]/40" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs">{item.category}</Badge>
                    {idx === 0 && <Badge className="bg-[#FF7D00]/10 text-[#FF7D00] border-0 text-xs">置顶</Badge>}
                  </div>
                  <p className="font-semibold text-gray-800 line-clamp-2 text-balance group-hover:text-[#165DFF] transition-colors">{item.title}</p>
                  {item.content && <p className="text-xs text-gray-400 mt-2 line-clamp-2 text-pretty">{item.content}</p>}
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
                    {item.views !== undefined && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{item.views}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          5. 社团活动
      ═══════════════════════════════════════════════════════════ */}
      <section id="activities" className="bg-white border-y border-[#E5E6EB] py-12">
        <div className="max-w-[1300px] mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-green-600" />社团活动
              </h2>
              <p className="text-gray-500 text-sm mt-1">精彩活动，报名参与（需登录）</p>
            </div>
            <Button variant="outline" onClick={() => goToCampus('activities')} className="gap-1.5 text-sm">
              查看全部<ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {activities.length === 0 ? (
            <div className="text-center py-10 text-gray-400">暂无活动</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activities.map(act => (
                <button key={act.id} onClick={() => goToCampus('activities')}
                  className="border border-[#E5E6EB] rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <Badge className={`shrink-0 text-xs ${act.signup_deadline && new Date(act.signup_deadline) > new Date() ? 'bg-green-50 text-green-600 border-green-200 border' : 'bg-gray-100 text-gray-500 border-0'}`}>
                      {act.signup_deadline && new Date(act.signup_deadline) > new Date() ? '报名中' : '已截止'}
                    </Badge>
                  </div>
                  <p className="font-semibold text-gray-800 group-hover:text-green-600 transition-colors text-balance">{act.title}</p>
                  {act.description && <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 text-pretty">{act.description}</p>}
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(act.start_time).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {act.location && <div className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />{act.location}</div>}
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      <span className="text-[#165DFF] ml-1">点击报名 →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          6. 二手市场 + 失物招领（并排两列）
      ═══════════════════════════════════════════════════════════ */}
      <section id="secondhand" className="max-w-[1300px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 二手市场 */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#FF7D00]" />二手市场
              </h2>
              <Button variant="ghost" size="sm" onClick={() => goToCampus('secondhand')} className="text-xs text-[#165DFF] gap-1">
                更多<ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-3">
              {secondhand.length === 0 && <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-[#E5E6EB]">暂无在售商品</div>}
              {secondhand.map(item => (
                <button key={item.id} onClick={() => goToCampus('secondhand')}
                  className="w-full bg-white rounded-xl border border-[#E5E6EB] p-4 flex items-center gap-4 hover:shadow-md transition-all text-left group">
                  <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-7 h-7 text-[#FF7D00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate group-hover:text-[#FF7D00] transition-colors">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-orange-50 text-[#FF7D00] border-0 text-xs">{item.category}</Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-[#FF7D00]">¥{item.price}</p>
                    <p className="text-xs text-gray-400">点击查看</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 失物招领 */}
          <div id="lostfound">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <MapPinOff className="w-5 h-5 text-red-500" />失物招领
              </h2>
              <Button variant="ghost" size="sm" onClick={() => goToCampus('lostfound')} className="text-xs text-[#165DFF] gap-1">
                更多<ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-3">
              {lostfound.length === 0 && <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-[#E5E6EB]">暂无寻找中的失物</div>}
              {lostfound.map(item => (
                <button key={item.id} onClick={() => goToCampus('lostfound')}
                  className="w-full bg-white rounded-xl border border-[#E5E6EB] p-4 flex items-center gap-4 hover:shadow-md transition-all text-left group">
                  <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <MapPinOff className="w-7 h-7 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate group-hover:text-red-500 transition-colors">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-red-50 text-red-500 border-0 text-xs">{item.post_type === 'lost' ? '失物' : '招领'}</Badge>
                      <span className="text-xs text-gray-400">{item.location}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge className={`text-xs ${item.status === 'open' ? 'bg-red-50 text-red-500 border-red-200 border' : 'bg-green-50 text-green-600 border-green-200 border'}`}>
                      {item.status === 'open' ? '寻找中' : '已找到'}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          7. 注册 CTA 横幅
      ═══════════════════════════════════════════════════════════ */}
      {!user && (
        <section className="py-16"
          style={{ background: 'linear-gradient(135deg, #0d2b8a 0%, #165DFF 60%, #1e86ff 100%)' }}>
          <div className="max-w-[1300px] mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold text-white mb-3">立即注册，解锁全部功能</h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto text-pretty">
              注册后可管理课程、记录打卡、发布二手、报名活动，享受完整的大学生活服务
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button onClick={() => navigate('/login')}
                className="h-12 px-8 text-base bg-white text-[#165DFF] hover:bg-white/90 font-semibold rounded-xl shadow-lg">
                免费注册
              </Button>
              <Button variant="ghost" onClick={() => navigate('/login')}
                className="h-12 px-8 text-base border border-white/40 text-white hover:bg-white/10 rounded-xl">
                已有账号？登录
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 底部 */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>© 2025 大学生学习管理平台 · 让校园生活更高效</p>
      </footer>

      <ContactAdminWidget />
      <LoginPromptModal
        open={loginPrompt.open}
        action={loginPrompt.action}
        onClose={() => setLoginPrompt({ open: false })}
      />
    </div>
  );
}
