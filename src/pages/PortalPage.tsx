import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CampusNews, ClubActivity, SecondHand, LostFound } from '@/types/types';
import {
  Search, BookOpen, Target, Building2, Bell, ChevronRight,
  Users, Megaphone, ShoppingBag, MapPinOff, ArrowRight,
  GraduationCap, Calendar, Clock, Eye, DoorOpen, Menu, X,
  Zap, TrendingUp, Library, MessageSquare, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  const [stats, setStats] = useState({ news: 0, activities: 0, secondhand: 0, lostfound: 0, users: 0 });
  const [loginPrompt, setLoginPrompt] = useState<{ open: boolean; action?: string; path?: string }>({ open: false });
  const [tickerIdx, setTickerIdx] = useState(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requireLogin = (path: string, label: string) => {
    if (user) { navigate(path); } else { setLoginPrompt({ open: true, action: label, path }); }
  };

  useEffect(() => {
    const fetchAll = async () => {
      const [
        { data: newsData, count: newsCount },
        { data: actData, count: actCount },
        { data: shData, count: shCount },
        { data: lfData, count: lfCount },
        { count: userCount },
      ] = await Promise.all([
        supabase.from('campus_news').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(6),
        supabase.from('club_activities').select('*', { count: 'exact' }).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(6),
        supabase.from('second_hand').select('*', { count: 'exact' }).eq('status', 'available').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
        supabase.from('lost_found').select('*', { count: 'exact' }).eq('status', 'open').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      setNews(newsData || []);
      setActivities(actData || []);
      setSecondhand(shData || []);
      setLostfound(lfData || []);
      setStats({ news: newsCount || 0, activities: actCount || 0, secondhand: shCount || 0, lostfound: lfCount || 0, users: userCount || 0 });
    };
    fetchAll();
  }, []);

  // 跑马灯自动轮播
  const tickerItems = news.slice(0, 5).map(n => n.title).filter(Boolean);
  useEffect(() => {
    if (tickerItems.length < 2) return;
    tickerRef.current = setInterval(() => setTickerIdx(i => (i + 1) % tickerItems.length), 4000);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [tickerItems.length]);

  const hotTags = [
    { label: '社团招新', path: '/campus?tab=activities' },
    { label: '选课指南', path: '/forum?cat=course' },
    { label: '四六级', path: '/forum?cat=cet' },
    { label: '考研资料', path: '/forum?cat=postgrad' },
    { label: '二手教材', path: '/campus?tab=secondhand' },
    { label: '失物招领', path: '/campus?tab=lostfound' },
    { label: '实习分享', path: '/forum?cat=internship' },
    { label: '空教室', path: '/campus?tab=classrooms' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/campus?search=${encodeURIComponent(searchQuery)}`);
  };

  const goToCampus = (tab?: string) => navigate(tab ? `/campus?tab=${tab}` : '/campus');

  const quickEntries = [
    { icon: BookOpen, label: '课程管理', desc: '课表/提醒', color: 'text-[#165DFF]', bg: 'bg-[#165DFF]/10', path: '/courses', login: true },
    { icon: Target,   label: '学习打卡', desc: '热力日历',   color: 'text-orange-500', bg: 'bg-orange-50',       path: '/goals',   login: true },
    { icon: Bell,     label: '任务提醒', desc: '截止预警',   color: 'text-purple-600', bg: 'bg-purple-50',        path: '/tasks',   login: true },
    { icon: Library,  label: '学习资料', desc: '资料共享',   color: 'text-pink-600',   bg: 'bg-pink-50',          path: '/materials', login: true },
    { icon: Building2, label: '校园生活', desc: '活动交易',  color: 'text-green-600',  bg: 'bg-green-50',         path: '/campus',  login: false },
    { icon: DoorOpen, label: '空教室',  desc: '实时查询',    color: 'text-cyan-600',   bg: 'bg-cyan-50',          path: '/campus?tab=classrooms', login: false },
    { icon: ShoppingBag, label: '二手市场', desc: '闲置买卖', color: 'text-[#FF7D00]', bg: 'bg-orange-50',       path: '/campus?tab=secondhand', login: false },
    { icon: MessageSquare, label: '校园论坛', desc: '交流互助', color: 'text-indigo-600', bg: 'bg-indigo-50',    path: '/forum',   login: false },
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F7]">
      <PortalNav />

      {/* ═══ 1. HERO 横幅 ═══ */}
      <section className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a1f6e 0%, #165DFF 55%, #1e86ff 100%)' }}>
        {/* 装饰圆 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-16 -right-16 w-[480px] h-[480px] rounded-full bg-white/5" />
          <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-white/4" />
          <div className="absolute top-1/3 right-[30%] w-48 h-48 rounded-full bg-[#FF7D00]/10" />
        </div>

        <div className="relative z-10 max-w-[1300px] mx-auto px-6 pt-24 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
            {/* 左：文字+搜索 */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-[#FF7D00]/90 text-white border-0 text-xs px-3 py-1 shrink-0">🎓 大学生一站式服务平台</Badge>
                <Badge className="bg-white/15 text-white/90 border-0 text-xs px-3 py-1 shrink-0">全新上线</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-2 text-balance">
                校园信息，尽在掌握
              </h1>
              <p className="text-white/75 text-base mb-5 max-w-lg text-pretty">
                课程管理 · 学习打卡 · 社团活动 · 二手交易 · 失物招领 · 校园论坛
              </p>

              {/* 搜索框 */}
              <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-lg">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索资讯、活动、二手物品..."
                    className="h-11 pl-10 pr-3 rounded-xl border-0 shadow-lg bg-white text-sm"
                  />
                </div>
                <Button type="submit" className="h-11 px-5 bg-[#FF7D00] hover:bg-[#FF7D00]/90 text-white font-semibold rounded-xl text-sm shadow-lg shrink-0">
                  搜索
                </Button>
              </form>

              {/* 热门标签 */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-white/50 flex items-center gap-1"><TrendingUp className="w-3 h-3" />热门：</span>
                {hotTags.map(({ label, path }) => (
                  <button key={label} onClick={() => navigate(path)}
                    className="px-2.5 py-1 rounded-full text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors border border-white/15">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 右：快速入口 2×4 宫格 */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-4 gap-2">
                {quickEntries.map(({ icon: Icon, label, desc, color, bg, path, login }) => (
                  <button key={label} onClick={() => login ? requireLogin(path, label) : navigate(path)}
                    className="bg-white/10 hover:bg-white/20 rounded-xl p-2.5 flex flex-col items-center gap-1 transition-all border border-white/10 hover:border-white/30 group">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg} shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: '18px', height: '18px' }} />
                    </div>
                    <span className="text-white/90 text-[11px] font-medium leading-tight text-center">{label}</span>
                    <span className="text-white/45 text-[9px] leading-tight text-center">{desc}</span>
                  </button>
                ))}
              </div>
              {!user && (
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => navigate('/login')}
                    className="flex-1 h-9 bg-white text-[#165DFF] hover:bg-white/90 font-semibold text-sm rounded-xl shadow">
                    免费注册
                  </Button>
                  <Button variant="ghost" onClick={() => navigate('/login')}
                    className="flex-1 h-9 border border-white/30 text-white hover:bg-white/10 text-sm rounded-xl">
                    已有账号登录
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 跑马灯公告栏 */}
        {tickerItems.length > 0 && (
          <div className="border-t border-white/10 bg-black/15">
            <div className="max-w-[1300px] mx-auto px-6 h-9 flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <Zap className="w-3.5 h-3.5 text-[#FF7D00]" />
                <span className="text-xs text-white/60 font-medium">最新资讯</span>
                <span className="text-white/20">·</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <span className="text-xs text-white/80 truncate block">{tickerItems[tickerIdx]}</span>
              </div>
              <div className="shrink-0 flex gap-1">
                {tickerItems.map((_, i) => (
                  <button key={i} onClick={() => setTickerIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === tickerIdx ? 'bg-white' : 'bg-white/30'}`} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══ 2. 实时数据统计条 ═══ */}
      <section className="bg-white border-b border-[#E5E6EB] shadow-sm sticky top-0 z-30">
        <div className="max-w-[1300px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-[#E5E6EB]">
            {[
              { icon: Users,       label: '注册用户',   value: stats.users,      unit: '人',    color: 'text-[#165DFF]'  },
              { icon: Megaphone,   label: '校园资讯',   value: stats.news,       unit: '条',    color: 'text-[#165DFF]'  },
              { icon: Users,       label: '招募活动',   value: stats.activities, unit: '个',    color: 'text-green-600'  },
              { icon: ShoppingBag, label: '在售商品',   value: stats.secondhand, unit: '件',    color: 'text-[#FF7D00]'  },
              { icon: MapPinOff,   label: '失物寻找',   value: stats.lostfound,  unit: '条',    color: 'text-purple-600' },
            ].map(({ icon: Icon, label, value, unit, color }) => (
              <div key={label} className="flex items-center gap-2.5 px-5 py-3">
                <Icon className={`w-4 h-4 ${color} shrink-0`} />
                <div>
                  <p className={`text-lg font-bold leading-none ${color}`}>{value.toLocaleString()}<span className="text-[11px] font-normal text-gray-400 ml-0.5">{unit}</span></p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. 主内容区：左侧（资讯+活动 Tabs） + 右侧（二手+失物） ═══ */}
      <div className="max-w-[1300px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── 左：资讯 & 活动 Tabs（占 2/3） ── */}
          <div className="lg:col-span-2 space-y-5">
            <Tabs defaultValue="news">
              <div className="flex items-center justify-between mb-3">
                <TabsList className="bg-white border border-[#E5E6EB] p-0.5 rounded-xl h-auto">
                  <TabsTrigger value="news" className="rounded-lg text-sm px-4 py-1.5 data-[state=active]:bg-[#165DFF] data-[state=active]:text-white">
                    <Megaphone className="w-3.5 h-3.5 mr-1.5" />校园资讯
                  </TabsTrigger>
                  <TabsTrigger value="activities" className="rounded-lg text-sm px-4 py-1.5 data-[state=active]:bg-green-600 data-[state=active]:text-white">
                    <Users className="w-3.5 h-3.5 mr-1.5" />社团活动
                  </TabsTrigger>
                  <TabsTrigger value="forum" className="rounded-lg text-sm px-4 py-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />论坛讨论
                  </TabsTrigger>
                </TabsList>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => goToCampus('news')} className="text-xs text-gray-400 hover:text-[#165DFF] gap-1 h-7 px-2">
                    更多<ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* 资讯列表 */}
              <TabsContent value="news" className="mt-0">
                {news.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#E5E6EB] py-16 text-center text-gray-400 text-sm">暂无资讯</div>
                ) : (
                  <div className="space-y-2.5">
                    {/* 头条大图卡 */}
                    {news[0] && (
                      <button onClick={() => goToCampus('news')}
                        className="w-full bg-white rounded-2xl border border-[#E5E6EB] overflow-hidden hover:shadow-md transition-all text-left flex group">
                        <div className="w-40 h-28 shrink-0 bg-gradient-to-br from-[#165DFF]/15 to-[#36a3ff]/15 flex items-center justify-center">
                          <Megaphone className="w-12 h-12 text-[#165DFF]/30" />
                        </div>
                        <div className="p-4 flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Badge className="bg-[#FF7D00]/10 text-[#FF7D00] border-0 text-[10px] px-2 py-0">头条</Badge>
                            <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-[10px] px-2 py-0">{news[0].category}</Badge>
                          </div>
                          <p className="font-semibold text-gray-800 text-sm line-clamp-2 group-hover:text-[#165DFF] transition-colors text-balance">{news[0].title}</p>
                          {news[0].content && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{news[0].content}</p>}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{new Date(news[0].created_at).toLocaleDateString('zh-CN')}</span>
                            {news[0].views !== undefined && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{news[0].views}</span>}
                          </div>
                        </div>
                      </button>
                    )}
                    {/* 列表项 */}
                    {news.slice(1).map(item => (
                      <button key={item.id} onClick={() => goToCampus('news')}
                        className="w-full bg-white rounded-xl border border-[#E5E6EB] px-4 py-3 hover:shadow-sm hover:border-[#165DFF]/30 transition-all text-left flex items-center gap-3 group">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#165DFF] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate group-hover:text-[#165DFF] transition-colors">{item.title}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2 text-[11px] text-gray-400">
                          <Badge className="bg-[#165DFF]/8 text-[#165DFF] border-0 text-[10px] px-1.5 py-0">{item.category}</Badge>
                          <span>{new Date(item.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 活动列表 */}
              <TabsContent value="activities" className="mt-0">
                {activities.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#E5E6EB] py-16 text-center text-gray-400 text-sm">暂无活动</div>
                ) : (
                  <div className="space-y-2.5">
                    {activities.map(act => (
                      <button key={act.id} onClick={() => goToCampus('activities')}
                        className="w-full bg-white rounded-xl border border-[#E5E6EB] px-4 py-3 hover:shadow-sm hover:border-green-300 transition-all text-left flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate group-hover:text-green-600 transition-colors">{act.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                            <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />
                              {new Date(act.start_time).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {act.location && <span className="flex items-center gap-0.5"><Building2 className="w-3 h-3" />{act.location}</span>}
                          </div>
                        </div>
                        <Badge className={`shrink-0 text-[10px] px-2 ${act.signup_deadline && new Date(act.signup_deadline) > new Date() ? 'bg-green-50 text-green-600 border-green-200 border' : 'bg-gray-100 text-gray-400 border-0'}`}>
                          {act.signup_deadline && new Date(act.signup_deadline) > new Date() ? '报名中' : '已截止'}
                        </Badge>
                      </button>
                    ))}
                    <Button variant="outline" className="w-full text-sm h-9 rounded-xl" onClick={() => goToCampus('activities')}>
                      查看全部活动 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* 论坛入口 */}
              <TabsContent value="forum" className="mt-0">
                <div className="bg-white rounded-2xl border border-[#E5E6EB] p-5">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: '选课指南', desc: '经验分享、课程评价',   path: '/forum?cat=course',     color: 'text-[#165DFF]', bg: 'bg-[#165DFF]/10' },
                      { label: '四六级考试', desc: '备考攻略、真题讨论', path: '/forum?cat=cet',        color: 'text-orange-500', bg: 'bg-orange-50' },
                      { label: '考研专区', desc: '资料分享、答疑解惑',   path: '/forum?cat=postgrad',   color: 'text-purple-600', bg: 'bg-purple-50' },
                      { label: '实习求职', desc: '内推信息、简历指导',   path: '/forum?cat=internship', color: 'text-green-600',  bg: 'bg-green-50' },
                      { label: '校园生活', desc: '吃喝玩乐、活动分享',   path: '/forum?cat=life',       color: 'text-pink-600',  bg: 'bg-pink-50' },
                      { label: '学习互助', desc: '组队自习、答疑互助',   path: '/forum',               color: 'text-cyan-600',  bg: 'bg-cyan-50' },
                    ].map(({ label, desc, path, color, bg }) => (
                      <button key={label} onClick={() => navigate(path)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E6EB] hover:shadow-sm hover:border-[#165DFF]/30 transition-all text-left group">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                          <MessageSquare className={`w-4 h-4 ${color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${color} truncate`}>{label}</p>
                          <p className="text-[11px] text-gray-400 truncate">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm h-9"
                    onClick={() => navigate('/forum')}>
                    进入论坛 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ── 右：二手 + 失物 + 登录引导（占 1/3） ── */}
          <div className="space-y-5">
            {/* 未登录引导卡 */}
            {!user && (
              <div className="bg-gradient-to-br from-[#165DFF] to-[#1e86ff] rounded-2xl p-5 text-white">
                <p className="font-bold text-base mb-1">加入平台，解锁全部功能</p>
                <p className="text-white/70 text-xs mb-4 leading-relaxed">注册后管理课程、记录打卡、发帖互动、报名活动</p>
                <div className="flex gap-2">
                  <Button onClick={() => navigate('/login')}
                    className="flex-1 h-8 bg-white text-[#165DFF] hover:bg-white/90 text-xs font-semibold rounded-lg">
                    免费注册
                  </Button>
                  <Button variant="ghost" onClick={() => navigate('/login')}
                    className="flex-1 h-8 border border-white/30 text-white hover:bg-white/10 text-xs rounded-lg">
                    登录
                  </Button>
                </div>
              </div>
            )}

            {/* 二手市场 */}
            <div className="bg-white rounded-2xl border border-[#E5E6EB]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E6EB]">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#FF7D00]" />二手市场
                </h3>
                <Button variant="ghost" size="sm" onClick={() => goToCampus('secondhand')}
                  className="text-xs text-gray-400 hover:text-[#FF7D00] gap-0.5 h-6 px-1.5">
                  更多<ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              <div className="divide-y divide-[#F0F2F7]">
                {secondhand.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-xs">暂无在售商品</p>
                ) : secondhand.slice(0, 4).map(item => (
                  <button key={item.id} onClick={() => goToCampus('secondhand')}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#FFF9F5] transition-colors text-left group">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <Tag className="w-3.5 h-3.5 text-[#FF7D00]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate group-hover:text-[#FF7D00] transition-colors">{item.title}</p>
                      <p className="text-[10px] text-gray-400">{item.category}</p>
                    </div>
                    <p className="text-sm font-bold text-[#FF7D00] shrink-0">¥{item.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 失物招领 */}
            <div className="bg-white rounded-2xl border border-[#E5E6EB]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E6EB]">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                  <MapPinOff className="w-4 h-4 text-red-500" />失物招领
                </h3>
                <Button variant="ghost" size="sm" onClick={() => goToCampus('lostfound')}
                  className="text-xs text-gray-400 hover:text-red-500 gap-0.5 h-6 px-1.5">
                  更多<ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              <div className="divide-y divide-[#F0F2F7]">
                {lostfound.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-xs">暂无寻找中的失物</p>
                ) : lostfound.slice(0, 4).map(item => (
                  <button key={item.id} onClick={() => goToCampus('lostfound')}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#FFF5F5] transition-colors text-left group">
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <MapPinOff className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate group-hover:text-red-500 transition-colors">{item.title}</p>
                      <p className="text-[10px] text-gray-400">{item.location || (item.post_type === 'lost' ? '失物' : '招领')}</p>
                    </div>
                    <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${item.status === 'open' ? 'bg-red-50 text-red-500 border-red-200 border' : 'bg-green-50 text-green-600 border-green-200 border'}`}>
                      {item.status === 'open' ? '寻找中' : '已找到'}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* 快捷入口卡 */}
            <div className="bg-white rounded-2xl border border-[#E5E6EB] p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">工具入口</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: BookOpen,   label: '课程表',   path: '/courses',  login: true,  color: 'text-[#165DFF]', bg: 'bg-[#165DFF]/10' },
                  { icon: Target,     label: '打卡',     path: '/goals',    login: true,  color: 'text-orange-500', bg: 'bg-orange-50' },
                  { icon: Bell,       label: '任务',     path: '/tasks',    login: true,  color: 'text-purple-600', bg: 'bg-purple-50' },
                  { icon: Library,    label: '资料',     path: '/materials',login: true,  color: 'text-pink-600',  bg: 'bg-pink-50' },
                  { icon: Users,      label: '小组',     path: '/study-groups', login: true, color: 'text-green-600', bg: 'bg-green-50' },
                  { icon: DoorOpen,   label: '空教室',   path: '/campus?tab=classrooms', login: false, color: 'text-cyan-600', bg: 'bg-cyan-50' },
                ].map(({ icon: Icon, label, path, login, color, bg }) => (
                  <button key={label} onClick={() => login ? requireLogin(path, label) : navigate(path)}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border border-[#E5E6EB] hover:border-[#165DFF]/30 hover:shadow-sm transition-all group">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <span className="text-[11px] text-gray-600">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 4. 底部 CTA（未登录显示） ═══ */}
      {!user && (
        <section className="py-12"
          style={{ background: 'linear-gradient(135deg, #0d2b8a 0%, #165DFF 60%, #1e86ff 100%)' }}>
          <div className="max-w-[1300px] mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 text-balance">立即注册，解锁全部功能</h2>
            <p className="text-white/75 text-sm mb-6 max-w-md mx-auto text-pretty">
              课程管理、学习打卡、论坛发帖、活动报名、二手买卖——注册即享
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button onClick={() => navigate('/login')}
                className="h-11 px-8 text-base bg-white text-[#165DFF] hover:bg-white/90 font-semibold rounded-xl shadow-lg">
                免费注册
              </Button>
              <Button variant="ghost" onClick={() => navigate('/login')}
                className="h-11 px-8 text-base border border-white/40 text-white hover:bg-white/10 rounded-xl">
                已有账号？登录
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 页脚 */}
      <footer className="bg-gray-900 text-gray-500 py-6 text-center text-xs">
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
