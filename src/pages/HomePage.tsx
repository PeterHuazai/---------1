import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Course, Task, Notification, Goal } from '@/types/types';
import {
  BookOpen, ClipboardList, Bell, Clock, MapPin, AlertCircle,
  Target, Building2, ChevronRight, Flame, FolderOpen,
  Users, TrendingUp, CheckCircle2, Circle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function HomePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [todayCourses, setTodayCourses] = useState<Course[]>([]);
  const [weekCourses, setWeekCourses] = useState<Course[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [materialCount, setMaterialCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayCheckinCount, setTodayCheckinCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 6 : today - 1;
    const todayStr = new Date().toISOString().slice(0, 10);

    const fetchData = async () => {
      const [
        { data: courses },
        { data: allCourses },
        { data: tasks },
        { data: notis },
        { data: checkins },
        { data: goalsData },
        { data: matData },
        { count: friendsCount },
        { count: pendingCount },
        { data: todayCheckins },
      ] = await Promise.all([
        supabase.from('courses').select('*').eq('user_id', user.id).eq('day_of_week', dayOfWeek).order('start_time', { ascending: true }),
        supabase.from('courses').select('*').eq('user_id', user.id),
        supabase.from('tasks').select('*, courses(name)').eq('user_id', user.id).in('status', ['未开始', '进行中']).order('due_date', { ascending: true }).limit(6),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('checkins').select('checkin_date').eq('user_id', user.id).order('checkin_date', { ascending: false }).limit(60),
        supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
        supabase.from('materials').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'accepted'),
        supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('friend_id', user.id).eq('status', 'pending'),
        supabase.from('checkins').select('id').eq('user_id', user.id).eq('checkin_date', todayStr),
      ]);

      setTodayCourses(courses || []);
      setWeekCourses(allCourses || []);
      setPendingTasks((tasks || []).map((t: any) => ({ ...t, course_name: t.courses?.name })));
      setNotifications(notis || []);
      setGoals(goalsData || []);
      setMaterialCount(matData?.length ?? 0);
      setFriendCount(friendsCount ?? 0);
      setPendingFriendCount(pendingCount ?? 0);
      setTodayCheckinCount(todayCheckins?.length ?? 0);

      // 连续打卡天数
      if (checkins?.length) {
        const dates = [...new Set(checkins.map((c: any) => c.checkin_date))].sort().reverse();
        let s = 0;
        let cur = new Date(new Date().toISOString().slice(0, 10));
        for (const d of dates) {
          const diff = (cur.getTime() - new Date(d).getTime()) / 86400000;
          if (diff <= 1) { s++; cur = new Date(d); } else break;
        }
        setStreak(s);
      }
    };
    fetchData();
  }, [user]);

  const getTaskUrgency = (dueDate: string) => {
    const hours = (new Date(dueDate).getTime() - Date.now()) / 3600000;
    if (hours <= 24) return { color: 'bg-red-50 text-red-600 border-red-200', label: '紧急' };
    if (hours <= 168) return { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: '近期' };
    return { color: 'bg-gray-50 text-gray-500 border-gray-200', label: '宽松' };
  };

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || '同学';
  const dateStr = new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // 本周每天课程数
  const weekCoursesMap = Array.from({ length: 7 }, (_, i) =>
    weekCourses.filter(c => c.day_of_week === i).length
  );
  const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  return (
    <Layout>
      {/* ── Hero 横幅 ── */}
      <div className="relative rounded-2xl overflow-hidden mb-6 min-h-[180px] md:min-h-[220px]"
        style={{ background: 'linear-gradient(135deg, #0d2b8a 0%, #165DFF 55%, #36a3ff 100%)' }}>
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-8 right-32 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative z-10 px-6 md:px-10 py-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-xs mb-1">{dateStr}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-balance">
              你好，{displayName} 👋
            </h1>
            <p className="text-white/75 mt-1.5 text-sm">
              今日 <span className="text-white font-semibold">{todayCourses.length}</span> 节课 ·
              待办 <span className="text-white font-semibold">{pendingTasks.length}</span> 项 ·
              打卡连续 <span className="text-white font-semibold">{streak}</span> 天
            </p>
          </div>
          {/* 右侧数据磁贴 */}
          <div className="flex items-center gap-3 flex-wrap shrink-0">
            {streak > 0 && (
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3">
                <Flame className="w-6 h-6 text-orange-300" />
                <div>
                  <p className="text-white/60 text-[10px]">打卡连击</p>
                  <p className="text-white text-xl font-bold leading-none">{streak}<span className="text-xs font-normal ml-0.5">天</span></p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3">
              <TrendingUp className="w-6 h-6 text-green-300" />
              <div>
                <p className="text-white/60 text-[10px]">今日打卡</p>
                <p className="text-white text-xl font-bold leading-none">{todayCheckinCount}<span className="text-xs font-normal ml-0.5">次</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3">
              <Users className="w-6 h-6 text-purple-300" />
              <div>
                <p className="text-white/60 text-[10px]">好友</p>
                <p className="text-white text-xl font-bold leading-none">
                  {friendCount}
                  {pendingFriendCount > 0 && <span className="text-[10px] font-normal text-yellow-300 ml-1">+{pendingFriendCount}</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 数据统计行 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: '今日课程', value: todayCourses.length, sub: '节', icon: BookOpen, color: 'text-[#165DFF]', bg: 'bg-[#165DFF]/10', path: '/courses' },
          { label: '待办任务', value: pendingTasks.length, sub: '项', icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50', path: '/tasks' },
          { label: '学习资料', value: materialCount, sub: '份', icon: FolderOpen, color: 'text-orange-500', bg: 'bg-orange-50', path: '/materials' },
          { label: '未读通知', value: unreadCount, sub: '条', icon: Bell, color: 'text-green-600', bg: 'bg-green-50', path: '/notifications' },
        ].map(({ label, value, sub, icon: Icon, color, bg, path }) => (
          <button key={path} onClick={() => navigate(path)}
            className="bg-white rounded-2xl border border-[#E5E6EB] p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: 18, height: 18 }} />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}<span className="text-sm font-normal text-gray-400 ml-0.5">{sub}</span></p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* ── 主内容区 3列 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* 左：今日课程 + 待办任务 */}
        <div className="lg:col-span-2 space-y-5">

          {/* 今日课程 */}
          <Card className="border-[#E5E6EB] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="w-4.5 h-4.5 text-[#165DFF]" style={{ width: 18, height: 18 }} />今日课程
                <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs ml-1">{todayCourses.length}节</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/courses')} className="text-xs text-[#165DFF] gap-1 h-7">
                全部<ChevronRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {todayCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <AlertCircle className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">今天没有课，好好休息 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayCourses.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA] hover:bg-[#EEF1FA] transition-colors">
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: c.color || '#165DFF' }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.start_time.slice(0,5)} — {c.end_time.slice(0,5)}</span>
                          {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
                        </div>
                      </div>
                      {c.teacher && <Badge variant="outline" className="text-xs shrink-0">{c.teacher}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 本周课程分布 */}
          <Card className="border-[#E5E6EB] shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="w-4.5 h-4.5 text-indigo-500" style={{ width: 18, height: 18 }} />本周课程分布
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/courses')} className="text-xs text-[#165DFF] gap-1 h-7">
                课程表<ChevronRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_DAYS.map((day, i) => {
                  const count = weekCoursesMap[i];
                  const isToday = i === today;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <span className={`text-[11px] font-medium ${isToday ? 'text-[#165DFF]' : 'text-gray-400'}`}>{day}</span>
                      <div className={`w-full rounded-lg flex items-center justify-center text-sm font-bold py-3 transition-all ${
                        isToday
                          ? 'bg-[#165DFF] text-white shadow-sm'
                          : count > 0
                          ? 'bg-[#165DFF]/10 text-[#165DFF]'
                          : 'bg-gray-50 text-gray-300'
                      }`}>
                        {count > 0 ? count : '—'}
                      </div>
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#165DFF]" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 待办任务 */}
          <Card className="border-[#E5E6EB] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-purple-500" style={{ width: 18, height: 18 }} />待办任务
                {pendingTasks.length > 0 && (
                  <Badge className="bg-purple-50 text-purple-600 border-0 text-xs ml-1">{pendingTasks.length}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="text-xs text-[#165DFF] gap-1 h-7">
                全部<ChevronRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <div className="flex items-center gap-2 py-6 justify-center text-gray-400">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <p className="text-sm">暂无待办任务，继续保持！</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pendingTasks.map((t) => {
                    const urgency = getTaskUrgency(t.due_date);
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F5F7FA] transition-colors group">
                        <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{t.course_name || '无课程'} · {new Date(t.due_date).toLocaleDateString('zh-CN')}</p>
                        </div>
                        <Badge variant="outline" className={`text-[11px] shrink-0 ${urgency.color}`}>{urgency.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：通知 + 打卡目标 + 好友 */}
        <div className="space-y-5">

          {/* 最新通知 */}
          <Card className="border-[#E5E6EB] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-[#165DFF]" style={{ width: 18, height: 18 }} />最新通知
                {unreadCount > 0 && (
                  <Badge className="bg-[#165DFF] text-white border-0 text-[11px] h-5 px-1.5">{unreadCount}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')} className="text-xs text-[#165DFF] gap-1 h-7">
                全部<ChevronRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无通知</p>
              ) : (
                <div className="space-y-1">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F5F7FA] transition-colors">
                      <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-gray-300' : 'bg-[#165DFF]'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 打卡目标进度 */}
          <Card className="border-[#E5E6EB] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="w-4.5 h-4.5 text-orange-500" style={{ width: 18, height: 18 }} />打卡目标
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/goals')} className="text-xs text-[#165DFF] gap-1 h-7">
                管理<ChevronRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">暂无打卡目标</p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/goals')} className="mt-3 text-xs h-7">
                    创建目标
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map((g) => {
                    const pct = Math.min(100, Math.round((todayCheckinCount / Math.max(1, g.target_value)) * 100));
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{g.name}</p>
                          <span className="text-xs text-gray-400 shrink-0 ml-2">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-[11px] text-gray-400 mt-0.5">{g.category} · {g.period}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 好友动态 */}
          <Card className="border-[#E5E6EB] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-purple-500" style={{ width: 18, height: 18 }} />好友
                {pendingFriendCount > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[11px] h-5 px-1.5">{pendingFriendCount}条请求</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/friends')} className="text-xs text-[#165DFF] gap-1 h-7">
                查看<ChevronRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-2">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{friendCount}</p>
                <p className="text-xs text-gray-400">位好友</p>
                <Button size="sm" onClick={() => navigate('/friends')}
                  className="mt-3 w-full h-8 text-xs bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-lg">
                  好友广场
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
