import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Users, Newspaper, DoorOpen, ShoppingBag, Search as SearchIcon,
  Trash2, ShieldOff, ShieldCheck, Plus, Edit2, Eye, TrendingUp, Activity,
  Mail, Clock, CheckCircle, Circle, Key, UserCog, Ban, ScrollText, BarChart3,
  Loader2, Calendar, MessageSquare, BookOpen, Pin, Send,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CampusNews, ClubActivity, Classroom, AdminLog } from '@/types/types';

// ─────────────────────────────────────────────────────────────
// 数据统计模块
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 数据统计模块（含可视化图表 + 日期筛选）
// ─────────────────────────────────────────────────────────────
function StatsPanel() {
  const [stats, setStats] = useState({
    users: 0, secondHand: 0, lostFound: 0,
    activities: 0, news: 0, classrooms: 0,
    forumPosts: 0, groupCount: 0,
  });
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [chartData, setChartData] = useState<{ date: string; 用户注册: number; 帖子: number; 二手: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [users, sh, lf, act, nws, cls, fp, sg] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('second_hand').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('lost_found').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('club_activities').select('*', { count: 'exact', head: true }),
        supabase.from('campus_news').select('*', { count: 'exact', head: true }),
        supabase.from('classrooms').select('*', { count: 'exact', head: true }),
        supabase.from('forum_posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('study_groups').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        users: users.count || 0, secondHand: sh.count || 0,
        lostFound: lf.count || 0, activities: act.count || 0,
        news: nws.count || 0, classrooms: cls.count || 0,
        forumPosts: fp.count || 0, groupCount: sg.count || 0,
      });
    };
    load();
  }, []);

  useEffect(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const loadChart = async () => {
      setChartLoading(true);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const [{ data: users }, { data: posts }, { data: sh }] = await Promise.all([
        supabase.from('profiles').select('created_at').gte('created_at', since),
        supabase.from('forum_posts').select('created_at').gte('created_at', since).eq('is_deleted', false),
        supabase.from('second_hand').select('created_at').gte('created_at', since).eq('is_deleted', false),
      ]);
      // 按天聚合
      const buckets: Record<string, { 用户注册: number; 帖子: number; 二手: number }> = {};
      const fmt = (d: string) => d.slice(0, 10);
      const step = days <= 30 ? 1 : 3;
      for (let i = 0; i < days; i += step) {
        const d = new Date(Date.now() - (days - 1 - i) * 86400000);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { 用户注册: 0, 帖子: 0, 二手: 0 };
      }
      (users || []).forEach(u => { const k = fmt(u.created_at); if (k in buckets) buckets[k].用户注册++; });
      (posts || []).forEach(p => { const k = fmt(p.created_at); if (k in buckets) buckets[k].帖子++; });
      (sh || []).forEach(s => { const k = fmt(s.created_at); if (k in buckets) buckets[k].二手++; });
      setChartData(Object.entries(buckets).map(([date, v]) => ({ date: date.slice(5), ...v })));
      setChartLoading(false);
    };
    loadChart();
  }, [dateRange]);

  const cards = [
    { label: '注册用户', value: stats.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '二手交易', value: stats.secondHand, icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '失物招领', value: stats.lostFound, icon: SearchIcon, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '社团活动', value: stats.activities, icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
    { label: '论坛帖子', value: stats.forumPosts, icon: Newspaper, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '学习小组', value: stats.groupCount, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-[#E5E6EB] h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 趋势图 */}
      <div className="bg-white border border-[#E5E6EB] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#165DFF]" />数据趋势
          </h3>
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as const).map(r => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  dateRange === r ? 'bg-[#165DFF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {r === '7d' ? '近7天' : r === '30d' ? '近30天' : '近90天'}
              </button>
            ))}
          </div>
        </div>
        {chartLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                <Line type="monotone" dataKey="用户注册" stroke="#165DFF" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="帖子" stroke="#7C3AED" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="二手" stroke="#FF7D00" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 用户管理模块（增强版：用户名、改密、设角色、封禁）
// ─────────────────────────────────────────────────────────────
interface UserRow {
  id: string; email: string; username: string;
  profile: { full_name: string | null; role: string; created_at: string; banned_until: string | null } | null;
  ban: { ban_until: string | null; reason: string | null } | null;
}

function UsersPanel() {
  const { profile: myProfile } = useAuth();
  const isSuperAdmin = myProfile?.role === 'superadmin';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  // 修改密码弹窗
  const [pwdTarget, setPwdTarget] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  // 封禁弹窗
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [banHours, setBanHours] = useState('72');
  const [banReason, setBanReason] = useState('');
  const [banPermanent, setBanPermanent] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  // 注销弹窗
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'list_users', page: 1, per_page: 100 },
    });
    if (error || !data?.users) { toast.error('加载用户失败'); setLoading(false); return; }
    setUsers(data.users as UserRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSetRole = async (u: UserRow, newRole: string) => {
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'set_role', target_id: u.id, new_role: newRole },
    });
    if (error || !data?.success) { toast.error('设置角色失败'); return; }
    toast.success('角色已更新');
    load();
  };

  const handleChangePassword = async () => {
    if (!pwdTarget) return;
    if (newPwd.length < 6) { toast.error('密码至少6位'); return; }
    setPwdLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'change_password', target_id: pwdTarget.id, new_password: newPwd },
    });
    setPwdLoading(false);
    if (error || !data?.success) { toast.error('修改密码失败'); return; }
    toast.success(`已修改 ${pwdTarget.username} 的密码`);
    setPwdTarget(null); setNewPwd('');
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: {
        action: 'ban_user', target_id: banTarget.id,
        reason: banReason || '违规行为',
        ban_hours: banPermanent ? null : parseInt(banHours) || 72,
      },
    });
    setBanLoading(false);
    if (error || !data?.success) {
      const msg = await error?.context?.text?.();
      toast.error(msg || '封禁失败'); return;
    }
    toast.success(banPermanent ? '已永久封禁该用户' : `已封禁 ${banHours} 小时`);
    setBanTarget(null); setBanReason(''); setBanHours('72'); setBanPermanent(false);
    load();
  };

  const handleUnban = async (u: UserRow) => {
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'unban_user', target_id: u.id },
    });
    if (error || !data?.success) { toast.error('解封失败'); return; }
    toast.success('已解封该用户');
    load();
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'delete_user', target_id: deleteTarget.id },
    });
    setDeleteLoading(false);
    if (error || !data?.success) {
      const msg = await error?.context?.text?.();
      toast.error(msg || '注销失败'); return;
    }
    toast.success(`用户 ${deleteTarget.username} 已注销`);
    setDeleteTarget(null);
    load();
  };

  const isBanned = (u: UserRow) => {
    if (!u.ban) return false;
    if (!u.ban.ban_until) return true; // 永久
    return new Date(u.ban.ban_until) > new Date();
  };

  const roleLabel: Record<string, string> = { user: '普通用户', admin: '管理员', superadmin: '超级管理员' };
  const roleColor: Record<string, string> = {
    superadmin: 'bg-red-100 text-red-600', admin: 'bg-[#FF7D00]/10 text-[#FF7D00]', user: 'bg-gray-100 text-gray-600',
  };

  const filtered = users.filter(u =>
    !search || u.email.includes(search) || u.username.includes(search) || (u.profile?.full_name || '').includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="搜索用户名/邮箱/昵称…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-gray-500 shrink-0">共 {filtered.length} 名用户</span>
      </div>

      <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
              {['用户名','邮箱','昵称','角色','注册时间','状态','操作'].map(h => (
                <th key={h} className="text-left px-3 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">无数据</td></tr>
            ) : filtered.map(u => {
              const banned = isBanned(u);
              const role = u.profile?.role || 'user';
              const isMe = u.id === myProfile?.id;
              return (
                <tr key={u.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                  <td className="px-3 py-3 font-medium text-gray-800">{u.username}</td>
                  <td className="px-3 py-3 text-gray-500 max-w-[160px] truncate">{u.email}</td>
                  <td className="px-3 py-3 text-gray-600">{u.profile?.full_name || '—'}</td>
                  <td className="px-3 py-3">
                    {isMe ? (
                      <Badge className={`${roleColor[role] || 'bg-gray-100 text-gray-600'} border-0`}>{roleLabel[role] || role}</Badge>
                    ) : (
                      <Select value={role} onValueChange={v => handleSetRole(u, v)} disabled={role === 'superadmin' && !isSuperAdmin}>
                        <SelectTrigger className="h-7 text-xs w-28 border-0 bg-transparent p-0 gap-1 focus:ring-0">
                          <Badge className={`${roleColor[role] || 'bg-gray-100 text-gray-600'} border-0 cursor-pointer`}>{roleLabel[role] || role}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">普通用户</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
                          {isSuperAdmin && <SelectItem value="superadmin">超级管理员</SelectItem>}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{u.profile?.created_at ? new Date(u.profile.created_at).toLocaleDateString('zh-CN') : '—'}</td>
                  <td className="px-3 py-3">
                    {banned
                      ? <Badge className="bg-red-100 text-red-600 border-0 text-xs">
                          {u.ban?.ban_until ? `封禁至 ${new Date(u.ban.ban_until).toLocaleDateString('zh-CN')}` : '永久封禁'}
                        </Badge>
                      : <Badge className="bg-green-100 text-green-600 border-0 text-xs">正常</Badge>}
                  </td>
                  <td className="px-3 py-3">
                    {!isMe && (
                      <div className="flex items-center gap-1">
                        {/* 改密 */}
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2"
                          onClick={() => { setPwdTarget(u); setNewPwd(''); }}>
                          <Key className="w-3 h-3" />改密
                        </Button>
                        {/* 封禁/解封 */}
                        {banned ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 text-green-600 border-green-200"
                            onClick={() => handleUnban(u)}>
                            <ShieldCheck className="w-3 h-3" />解封
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 text-red-600 border-red-200"
                            onClick={() => { setBanTarget(u); setBanReason(''); setBanHours('72'); setBanPermanent(false); }}>
                            <Ban className="w-3 h-3" />封禁
                          </Button>
                        )}
                        {/* 注销（仅超管） */}
                        {isSuperAdmin && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="w-3 h-3" />注销
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 修改密码弹窗 */}
      <Dialog open={!!pwdTarget} onOpenChange={o => { if (!o) setPwdTarget(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>修改密码 — {pwdTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-sm">新密码（至少6位）</Label>
            <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="输入新密码" className="h-10" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPwdTarget(null)}>取消</Button>
              <Button disabled={pwdLoading || newPwd.length < 6} onClick={handleChangePassword}
                className="bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5">
                {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}确认修改
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 封禁弹窗 */}
      <Dialog open={!!banTarget} onOpenChange={o => { if (!o) setBanTarget(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>封禁用户 — {banTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-sm">封禁原因</Label>
            <Input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="请填写封禁原因" className="h-10" />
            {isSuperAdmin && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={banPermanent} onChange={e => setBanPermanent(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium text-red-600">永久封禁（仅超级管理员）</span>
              </label>
            )}
            {!banPermanent && (
              <div>
                <Label className="text-sm">封禁时长</Label>
                <Select value={banHours} onValueChange={setBanHours}>
                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1小时</SelectItem>
                    <SelectItem value="24">24小时</SelectItem>
                    <SelectItem value="72">72小时（3天）</SelectItem>
                    <SelectItem value="168">168小时（7天）</SelectItem>
                    <SelectItem value="720">720小时（30天）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBanTarget(null)}>取消</Button>
              <Button disabled={banLoading} onClick={handleBan}
                className="bg-red-500 hover:bg-red-600 text-white gap-1.5">
                {banLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {banPermanent ? '永久封禁' : `封禁 ${banHours}h`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* 注销用户确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>注销用户 — {deleteTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <strong>⚠️ 此操作不可撤销</strong><br />
              用户账号将被永久删除，包括其所有数据。请确认后再操作。
            </div>
            <p className="text-sm text-gray-600">即将注销：<span className="font-semibold">{deleteTarget?.email}</span></p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button disabled={deleteLoading} onClick={handleDeleteUser}
                className="bg-red-500 hover:bg-red-600 text-white gap-1.5">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                确认注销
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────
function NewsPanel() {
  const { user } = useAuth();
  const [news, setNews] = useState<CampusNews[]>([]);
  const [editing, setEditing] = useState<Partial<CampusNews> | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('campus_news').select('*').order('created_at', { ascending: false }).limit(100);
    setNews(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing?.title || !editing?.content) { toast.error('标题和内容不能为空'); return; }
    if (editing.id) {
      const { error } = await supabase.from('campus_news').update({
        title: editing.title, content: editing.content, category: editing.category || '通知', updated_at: new Date().toISOString()
      }).eq('id', editing.id);
      if (error) { toast.error('更新失败'); return; }
      toast.success('已更新');
    } else {
      const { error } = await supabase.from('campus_news').insert({
        title: editing.title, content: editing.content, category: editing.category || '通知', published_by: user?.id
      });
      if (error) { toast.error('发布失败'); return; }
      toast.success('已发布');
    }
    setOpen(false); setEditing(null); load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除此条资讯？')) return;
    const { error } = await supabase.from('campus_news').delete().eq('id', id);
    if (error) { toast.error('删除失败'); return; }
    toast.success('已删除');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {news.length} 条资讯</span>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90" onClick={() => setEditing({ category: '通知' })}>
              <Plus className="w-4 h-4 mr-1" />新增资讯
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? '编辑资讯' : '新增资讯'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>标题 *</Label><Input value={editing?.title || ''} onChange={e => setEditing(f => ({ ...f, title: e.target.value }))} /></div>
              <div className="space-y-1"><Label>分类</Label>
                <Select value={editing?.category || '通知'} onValueChange={v => setEditing(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['通知','新闻','公告'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>内容 *</Label><Textarea rows={6} value={editing?.content || ''} onChange={e => setEditing(f => ({ ...f, content: e.target.value }))} /></div>
            </div>
            <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 mt-2" onClick={handleSave}>保存</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
              {['标题','分类','浏览量','发布时间','操作'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {news.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">暂无资讯</td></tr>
            ) : news.map(item => (
              <tr key={item.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                <td className="px-4 py-3 max-w-xs"><span className="font-medium text-gray-800 truncate block max-w-[200px]">{item.title}</span></td>
                <td className="px-4 py-3"><Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0">{item.category}</Badge></td>
                <td className="px-4 py-3 text-gray-500 flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{item.views}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(item.created_at).toLocaleDateString('zh-CN')}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                      onClick={() => { setEditing(item); setOpen(true); }}>
                      <Edit2 className="w-3.5 h-3.5" />编辑
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />删除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 社团活动管理
// ─────────────────────────────────────────────────────────────
function ActivitiesPanel() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [editing, setEditing] = useState<Partial<ClubActivity> | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('club_activities').select('*').order('start_time', { ascending: false }).limit(100);
    setActivities(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing?.title || !editing?.club_name || !editing?.start_time) { toast.error('请填写必填项'); return; }
    if (editing.id) {
      const { error } = await supabase.from('club_activities').update({ title: editing.title, club_name: editing.club_name, description: editing.description || null, location: editing.location || null, start_time: editing.start_time, end_time: editing.end_time || null, signup_deadline: editing.signup_deadline || null }).eq('id', editing.id);
      if (error) { toast.error('更新失败'); return; }
      toast.success('已更新');
    } else {
      const { error } = await supabase.from('club_activities').insert({ title: editing.title, club_name: editing.club_name, description: editing.description || null, location: editing.location || null, start_time: editing.start_time, end_time: editing.end_time || null, signup_deadline: editing.signup_deadline || null, published_by: user?.id });
      if (error) { toast.error('发布失败'); return; }
      toast.success('已发布');
    }
    setOpen(false); setEditing(null); load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除此活动？')) return;
    const { error } = await supabase.from('club_activities').delete().eq('id', id);
    if (error) { toast.error('删除失败'); return; }
    toast.success('已删除');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {activities.length} 个活动</span>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90" onClick={() => setEditing({})}>
              <Plus className="w-4 h-4 mr-1" />新增活动
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? '编辑活动' : '新增活动'}</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {[['活动名称 *', 'title', 'text'], ['社团名称 *', 'club_name', 'text'], ['活动地点', 'location', 'text']].map(([label, key]) => (
                <div key={key} className="space-y-1"><Label>{label}</Label>
                  <Input value={(editing as any)?.[key] || ''} onChange={e => setEditing(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              {[['开始时间 *', 'start_time'], ['结束时间', 'end_time'], ['报名截止时间', 'signup_deadline']].map(([label, key]) => (
                <div key={key} className="space-y-1"><Label>{label}</Label>
                  <Input type="datetime-local" value={(editing as any)?.[key] ? (editing as any)[key].slice(0,16) : ''} onChange={e => setEditing(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-1"><Label>活动描述</Label><Textarea rows={3} value={editing?.description || ''} onChange={e => setEditing(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 mt-2" onClick={handleSave}>保存</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
              {['活动名称','社团','开始时间','地点','操作'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">暂无活动</td></tr>
            ) : activities.map(act => (
              <tr key={act.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                <td className="px-4 py-3 max-w-[200px]"><span className="font-medium text-gray-800 truncate block">{act.title}</span></td>
                <td className="px-4 py-3 text-gray-600">{act.club_name}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(act.start_time).toLocaleDateString('zh-CN')}</td>
                <td className="px-4 py-3 text-gray-500">{act.location || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => { setEditing(act); setOpen(true); }}><Edit2 className="w-3.5 h-3.5" />编辑</Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(act.id)}><Trash2 className="w-3.5 h-3.5" />删除</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 空教室数据管理
// ─────────────────────────────────────────────────────────────
const DAY_NAMES = ['周一','周二','周三','周四','周五','周六','周日'];

function ClassroomsPanel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [editing, setEditing] = useState<Partial<Classroom & { slot_day: string; slot_start: string; slot_end: string }> | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('classrooms').select('*').order('building').limit(200);
    setClassrooms(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing?.building || !editing?.room_name) { toast.error('楼栋和教室名不能为空'); return; }
    let roomId = editing.id;
    if (editing.id) {
      const { error } = await supabase.from('classrooms').update({ building: editing.building, room_name: editing.room_name, floor: editing.floor || 1, capacity: editing.capacity || 50 }).eq('id', editing.id);
      if (error) { toast.error('更新失败'); return; }
    } else {
      const { data, error } = await supabase.from('classrooms').insert({ building: editing.building, room_name: editing.room_name, floor: editing.floor || 1, capacity: editing.capacity || 50 }).select().maybeSingle();
      if (error || !data) { toast.error('添加失败'); return; }
      roomId = data.id;
    }
    // 若填了时段信息就插入
    if (editing.slot_day !== undefined && editing.slot_start && editing.slot_end && roomId) {
      await supabase.from('classroom_slots').insert({ classroom_id: roomId, day_of_week: parseInt(editing.slot_day), start_time: editing.slot_start, end_time: editing.slot_end });
    }
    toast.success(editing.id ? '已更新' : '已添加');
    setOpen(false); setEditing(null); load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除此教室？相关时段也会删除。')) return;
    const { error } = await supabase.from('classrooms').delete().eq('id', id);
    if (error) { toast.error('删除失败'); return; }
    toast.success('已删除');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {classrooms.length} 间教室</span>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90" onClick={() => setEditing({ slot_day: '0', slot_start: '08:00', slot_end: '12:00' })}>
              <Plus className="w-4 h-4 mr-1" />新增教室
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? '编辑教室' : '新增教室'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {[['楼栋 *', 'building'], ['教室名称 *', 'room_name']].map(([label, key]) => (
                <div key={key} className="space-y-1"><Label>{label}</Label>
                  <Input value={(editing as any)?.[key] || ''} onChange={e => setEditing(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>楼层</Label><Input type="number" value={editing?.floor || 1} onChange={e => setEditing(f => ({ ...f, floor: parseInt(e.target.value) || 1 }))} /></div>
                <div className="space-y-1"><Label>容纳人数</Label><Input type="number" value={editing?.capacity || 50} onChange={e => setEditing(f => ({ ...f, capacity: parseInt(e.target.value) || 50 }))} /></div>
              </div>
              {!editing?.id && (
                <>
                  <div className="border-t border-[#E5E6EB] pt-3">
                    <p className="text-sm text-gray-500 mb-3">可选：添加一个空闲时段</p>
                    <div className="space-y-3">
                      <div className="space-y-1"><Label>星期</Label>
                        <Select value={editing?.slot_day || '0'} onValueChange={v => setEditing(f => ({ ...f, slot_day: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>开始时间</Label><Input type="time" value={editing?.slot_start || '08:00'} onChange={e => setEditing(f => ({ ...f, slot_start: e.target.value }))} /></div>
                        <div className="space-y-1"><Label>结束时间</Label><Input type="time" value={editing?.slot_end || '12:00'} onChange={e => setEditing(f => ({ ...f, slot_end: e.target.value }))} /></div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 mt-2" onClick={handleSave}>保存</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
              {['教室名称','楼栋','楼层','容量','操作'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classrooms.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">暂无教室数据</td></tr>
            ) : classrooms.map(room => (
              <tr key={room.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                <td className="px-4 py-3 font-medium text-gray-800">{room.room_name}</td>
                <td className="px-4 py-3 text-gray-600">{room.building}</td>
                <td className="px-4 py-3 text-gray-500">{room.floor}楼</td>
                <td className="px-4 py-3 text-gray-500">{room.capacity}人</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => { setEditing(room); setOpen(true); }}><Edit2 className="w-3.5 h-3.5" />编辑</Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(room.id)}><Trash2 className="w-3.5 h-3.5" />删除</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 二手 & 失物管理（违规内容删除）
// ─────────────────────────────────────────────────────────────
function ContentModerationPanel() {
  const [secondHand, setSecondHand] = useState<any[]>([]);
  const [lostFound, setLostFound] = useState<any[]>([]);
  const [tab, setTab] = useState<'sh'|'lf'>('sh');

  const load = async () => {
    const [sh, lf] = await Promise.all([
      supabase.from('second_hand').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(100),
      supabase.from('lost_found').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(100),
    ]);
    setSecondHand(sh.data || []);
    setLostFound(lf.data || []);
  };

  useEffect(() => { load(); }, []);

  const deleteSH = async (id: string) => {
    if (!window.confirm('确认标记该帖子为违规删除？')) return;
    const { error } = await supabase.from('second_hand').update({ is_deleted: true }).eq('id', id);
    if (error) { toast.error('操作失败'); return; }
    toast.success('已删除');
    load();
  };

  const deleteLF = async (id: string) => {
    if (!window.confirm('确认标记该帖子为违规删除？')) return;
    const { error } = await supabase.from('lost_found').update({ is_deleted: true }).eq('id', id);
    if (error) { toast.error('操作失败'); return; }
    toast.success('已删除');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('sh')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'sh' ? 'bg-[#165DFF] text-white' : 'bg-white border border-[#E5E6EB] text-gray-600'}`}>
          二手交易（{secondHand.length}）
        </button>
        <button onClick={() => setTab('lf')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'lf' ? 'bg-[#165DFF] text-white' : 'bg-white border border-[#E5E6EB] text-gray-600'}`}>
          失物招领（{lostFound.length}）
        </button>
      </div>

      {tab === 'sh' && (
        <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead><tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
              {['物品名','分类','价格','发布时间','操作'].map(h => <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {secondHand.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">暂无数据</td></tr> :
              secondHand.map(item => (
                <tr key={item.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]"><span className="truncate block">{item.title}</span></td>
                  <td className="px-4 py-3"><Badge className="bg-gray-100 text-gray-600 border-0">{item.category}</Badge></td>
                  <td className="px-4 py-3 text-[#FF7D00] font-semibold">¥{Number(item.price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(item.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-500 border-red-200 hover:bg-red-50" onClick={() => deleteSH(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'lf' && (
        <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead><tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
              {['标题','类型','状态','发布时间','操作'].map(h => <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {lostFound.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">暂无数据</td></tr> :
              lostFound.map(post => (
                <tr key={post.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]"><span className="truncate block">{post.title}</span></td>
                  <td className="px-4 py-3">
                    <Badge className={post.post_type === 'lost' ? 'bg-red-100 text-red-600 border-0' : 'bg-green-100 text-green-600 border-0'}>
                      {post.post_type === 'lost' ? '失物' : '招领'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={post.status === 'open' ? 'bg-blue-100 text-blue-600 border-0' : 'bg-gray-100 text-gray-500 border-0'}>
                      {post.status === 'open' ? '寻找中' : '已找到'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(post.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-500 border-red-200 hover:bg-red-50" onClick={() => deleteLF(post.id)}>
                      <Trash2 className="w-3.5 h-3.5" />删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 联系消息面板
// ─────────────────────────────────────────────────────────────
interface ContactMessage {
  id: string;
  user_id: string;
  subject: string;
  content: string;
  is_read: boolean;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  // 附加
  user_name?: string;
  user_email?: string;
}

function ContactMessagesPanel() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    const msgs: ContactMessage[] = data || [];
    // 批量获取用户名
    const uids = [...new Set(msgs.map(m => m.user_id))];
    let nameMap: Record<string, { name: string; email: string }> = {};
    if (uids.length) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, email')
        .in('id', uids);
      (profiles || []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
        nameMap[p.id] = {
          name: p.full_name || p.email?.split('@')[0] || '用户',
          email: p.email || '',
        };
      });
    }

    setMessages(msgs.map(m => ({
      ...m,
      user_name: nameMap[m.user_id]?.name,
      user_email: nameMap[m.user_id]?.email,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const handleMarkRead = async (msg: ContactMessage) => {
    if (msg.is_read) return;
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', msg.id);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
  };

  const handleSelectMessage = (msg: ContactMessage) => {
    setSelected(msg);
    setReply(msg.admin_reply || '');
    handleMarkRead(msg);
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setReplying(true);
    const { error } = await supabase.from('contact_messages')
      .update({
        admin_reply: reply.trim(),
        replied_at: new Date().toISOString(),
        status: 'replied',
        is_read: true,
      })
      .eq('id', selected.id);
    setReplying(false);
    if (error) { toast.error('保存失败'); return; }
    toast.success('回复已保存');
    setSelected(prev => prev ? { ...prev, admin_reply: reply.trim(), replied_at: new Date().toISOString(), status: 'replied' } : null);
    loadMessages();
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="flex gap-4 h-[calc(100vh-320px)] min-h-[400px]">
      {/* 消息列表 */}
      <div className="w-64 shrink-0 border border-[#E5E6EB] rounded-xl overflow-hidden flex flex-col">
        <div className="px-3 py-2.5 border-b border-[#E5E6EB] bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">用户来信</span>
          {unreadCount > 0 && (
            <Badge className="bg-[#165DFF] text-white border-0 text-[10px] h-4 px-1.5">{unreadCount}条未读</Badge>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-center py-12">
              <Mail className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">暂无消息</p>
            </div>
          )}
          {messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => handleSelectMessage(msg)}
              className={`w-full text-left px-3 py-3 border-b border-[#F0F2F7] hover:bg-gray-50 transition-colors ${
                selected?.id === msg.id ? 'bg-[#165DFF]/5' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {!msg.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[#165DFF] shrink-0" />}
                <span className="text-xs font-medium text-gray-700 truncate flex-1">{msg.user_name || '用户'}</span>
                {msg.status === 'replied' && (
                  <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{msg.subject}</p>
              <p className="text-[10px] text-gray-300 mt-0.5">
                {new Date(msg.created_at).toLocaleDateString('zh-CN')}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 消息详情 */}
      {selected ? (
        <div className="flex-1 min-w-0 border border-[#E5E6EB] rounded-xl overflow-hidden flex flex-col">
          {/* 头部 */}
          <div className="px-5 py-3 border-b border-[#E5E6EB] bg-gray-50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm text-balance">{selected.subject}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500">{selected.user_name}</span>
                  {selected.user_email && (
                    <span className="text-xs text-gray-400">{selected.user_email}</span>
                  )}
                  <span className="text-xs text-gray-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(selected.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
              <Badge className={`text-xs shrink-0 ${
                selected.status === 'replied'
                  ? 'bg-green-50 text-green-600 border-green-200 border'
                  : 'bg-yellow-50 text-yellow-600 border-yellow-200 border'
              }`}>
                {selected.status === 'replied' ? '已回复' : '待处理'}
              </Badge>
            </div>
          </div>

          {/* 用户消息内容 */}
          <div className="px-5 py-4 flex-1 overflow-y-auto space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">用户消息：</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
            </div>

            {/* 管理员回复区 */}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">
                管理员备注 / 回复内容（保存后用户可在消息页查看）
              </Label>
              <Textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="填写处理备注或回复内容…"
                rows={4}
                className="text-sm resize-none"
              />
              {selected.replied_at && (
                <p className="text-[10px] text-gray-300 mt-1">
                  上次回复：{new Date(selected.replied_at).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-[#E5E6EB] flex justify-end">
            <Button
              onClick={handleReply}
              disabled={replying || !reply.trim()}
              className="h-9 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5"
            >
              {replying ? '保存中…' : '保存回复'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 border border-[#E5E6EB] rounded-xl">
          <div className="text-center">
            <Mail className="w-12 h-12 mx-auto mb-3 text-gray-100" />
            <p className="text-sm text-gray-400">点击左侧消息查看详情</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 管理员操作日志模块
// ─────────────────────────────────────────────────────────────
function AdminLogsPanel() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const actionLabel: Record<string, string> = {
    change_password: '修改密码', set_role: '设置角色', ban_user: '封禁用户',
    unban_user: '解封用户', contact_message_received: '收到联系消息',
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('admin_logs')
        .select('*').order('created_at', { ascending: false }).limit(100);
      const logsData = (data || []) as AdminLog[];
      if (logsData.length) {
        const ids = [...new Set(logsData.map(l => l.admin_id))];
        const { data: profiles } = await supabase.from('public_profiles').select('id,full_name').in('id', ids);
        const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || '管理员']));
        logsData.forEach(l => { l.admin_name = nameMap[l.admin_id] || '管理员'; });
      }
      setLogs(logsData);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter(l =>
    !search || l.action.includes(search) || (l.admin_name || '').includes(search)
      || (l.target_id || '').includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="搜索操作/管理员…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
              {['时间','管理员','操作','对象类型','对象ID','详情'].map(h => (
                <th key={h} className="text-left px-3 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无操作记录</td></tr>
            ) : filtered.map(l => (
              <tr key={l.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                <td className="px-3 py-3 text-gray-400 text-xs">{new Date(l.created_at).toLocaleString('zh-CN')}</td>
                <td className="px-3 py-3 font-medium text-gray-700">{l.admin_name}</td>
                <td className="px-3 py-3">
                  <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs">
                    {actionLabel[l.action] || l.action}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-gray-500 text-xs">{l.target_type || '—'}</td>
                <td className="px-3 py-3 text-gray-400 text-xs max-w-[100px] truncate">{l.target_id || '—'}</td>
                <td className="px-3 py-3 text-gray-400 text-xs max-w-[180px] truncate">
                  {l.details ? JSON.stringify(l.details).slice(0, 80) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 管理后台主页（权限校验 + 侧边栏布局）
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 论坛管理
// ─────────────────────────────────────────────────────────────
interface ForumCategory {
  id: string; key: string; label: string; icon_name: string;
  color: string; description: string | null; sort_order: number; is_active: boolean;
}
interface ForumPostAdmin {
  id: string; category: string; title: string; author_id: string;
  views: number; is_pinned: boolean; is_deleted: boolean; created_at: string;
  author_name?: string;
}

function ForumAdminPanel() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [posts, setPosts] = useState<ForumPostAdmin[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postSearch, setPostSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  // 新增板块
  const [catDialog, setCatDialog] = useState(false);
  const [catForm, setCatForm] = useState({ key: '', label: '', description: '' });
  const [catSaving, setCatSaving] = useState(false);
  // 发帖弹窗
  const [postDialog, setPostDialog] = useState(false);
  const [postForm, setPostForm] = useState({ category: '', title: '', content: '' });
  const [postSaving, setPostSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    const { data } = await supabase.from('forum_categories').select('*').order('sort_order');
    setCategories((data || []) as ForumCategory[]);
    setCatLoading(false);
  }, []);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    let q = supabase.from('forum_posts').select('*').order('created_at', { ascending: false }).limit(100);
    if (selectedCat !== 'all') q = q.eq('category', selectedCat);
    const { data: postsData } = await q;
    const ps = (postsData || []) as ForumPostAdmin[];
    if (ps.length) {
      const ids = [...new Set(ps.map(p => p.author_id))];
      const { data: profiles } = await supabase.from('public_profiles').select('id,full_name').in('id', ids);
      const nm = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || '用户']));
      ps.forEach(p => { p.author_name = nm[p.author_id] || '用户'; });
    }
    setPosts(ps);
    setPostsLoading(false);
  }, [selectedCat]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleToggleActive = async (cat: ForumCategory) => {
    const { error } = await supabase.from('forum_categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    if (error) { toast.error('操作失败'); return; }
    toast.success(cat.is_active ? '板块已停用' : '板块已启用');
    loadCategories();
  };

  const handleDeleteCategory = async (cat: ForumCategory) => {
    if (!confirm(`确定删除板块「${cat.label}」？该板块下所有帖子的分类将不再关联此板块。`)) return;
    const { error } = await supabase.from('forum_categories').delete().eq('id', cat.id);
    if (error) { toast.error('删除失败'); return; }
    toast.success('板块已删除');
    loadCategories();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.key.trim() || !catForm.label.trim()) { toast.error('板块标识和名称不能为空'); return; }
    setCatSaving(true);
    const { error } = await supabase.from('forum_categories').insert({
      key: catForm.key.trim().toLowerCase(),
      label: catForm.label.trim(),
      description: catForm.description.trim() || null,
      sort_order: categories.length + 1,
    });
    setCatSaving(false);
    if (error) { toast.error(error.code === '23505' ? '板块标识已存在' : '添加失败'); return; }
    toast.success('板块添加成功');
    setCatDialog(false);
    setCatForm({ key: '', label: '', description: '' });
    loadCategories();
  };

  const handleTogglePin = async (post: ForumPostAdmin) => {
    await supabase.from('forum_posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id);
    toast.success(post.is_pinned ? '已取消置顶' : '已置顶');
    loadPosts();
  };

  const handleDeletePost = async (post: ForumPostAdmin) => {
    if (!confirm(`确定删除帖子「${post.title}」？`)) return;
    await supabase.from('forum_posts').update({ is_deleted: true }).eq('id', post.id);
    toast.success('帖子已删除');
    loadPosts();
  };

  const handleRestorePost = async (post: ForumPostAdmin) => {
    await supabase.from('forum_posts').update({ is_deleted: false }).eq('id', post.id);
    toast.success('帖子已恢复');
    loadPosts();
  };

  const handlePostAsAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!postForm.category) { toast.error('请选择版块'); return; }
    if (!postForm.title.trim() || postForm.title.length < 5) { toast.error('标题至少5个字'); return; }
    if (!postForm.content.trim()) { toast.error('请填写内容'); return; }
    setPostSaving(true);
    const { error } = await supabase.from('forum_posts').insert({
      category: postForm.category,
      title: postForm.title.trim(),
      content: postForm.content.trim(),
      author_id: user.id,
      is_pinned: false,
    });
    setPostSaving(false);
    if (error) { toast.error('发帖失败'); return; }
    toast.success('发帖成功');
    setPostDialog(false);
    setPostForm({ category: '', title: '', content: '' });
    loadPosts();
  };

  const filteredPosts = posts.filter(p =>
    !postSearch || p.title.includes(postSearch) || (p.author_name || '').includes(postSearch)
  );

  return (
    <div className="space-y-6">
      {/* 版块管理 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#165DFF]" />版块管理
          </h3>
          <Button size="sm" className="h-8 text-xs bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1"
            onClick={() => setCatDialog(true)}>
            <Plus className="w-3.5 h-3.5" />新增板块
          </Button>
        </div>
        {catLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-[#E5E6EB]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{cat.label}</span>
                    <Badge className={`text-[10px] border-0 ${cat.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {cat.is_active ? '启用' : '停用'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{cat.description || cat.key}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                    onClick={() => handleToggleActive(cat)}>
                    {cat.is_active ? '停用' : '启用'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-500 border-red-200 hover:bg-red-50"
                    onClick={() => handleDeleteCategory(cat)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 帖子管理 */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#165DFF]" />帖子管理
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedCat} onValueChange={setSelectedCat}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部版块</SelectItem>
                {categories.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input value={postSearch} onChange={e => setPostSearch(e.target.value)}
                placeholder="搜索标题/作者" className="h-8 text-xs pl-6 w-36" />
            </div>
            <Button size="sm" className="h-8 text-xs bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1"
              onClick={() => setPostDialog(true)}>
              <Send className="w-3.5 h-3.5" />管理员发帖
            </Button>
          </div>
        </div>

        <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#E5E6EB] bg-[#F5F7FA]">
                {['标题','版块','作者','浏览','状态','操作'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {postsLoading ? (
                <tr><td colSpan={6} className="text-center py-6 text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
              ) : filteredPosts.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-gray-400 text-xs">暂无帖子</td></tr>
              ) : filteredPosts.map(post => (
                <tr key={post.id} className="border-b border-[#F5F7FA] hover:bg-[#F5F7FA]/50">
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <div className="flex items-center gap-1">
                      {post.is_pinned && <Pin className="w-3 h-3 text-orange-400 shrink-0" />}
                      <span className="truncate text-gray-800">{post.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs">
                      {categories.find(c => c.key === post.category)?.label || post.category}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{post.author_name}</td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{post.views}</td>
                  <td className="px-3 py-2.5">
                    {post.is_deleted
                      ? <Badge className="bg-red-100 text-red-500 border-0 text-xs">已删除</Badge>
                      : <Badge className="bg-green-100 text-green-600 border-0 text-xs">正常</Badge>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1"
                        onClick={() => handleTogglePin(post)}>
                        <Pin className="w-3 h-3" />{post.is_pinned ? '取消置顶' : '置顶'}
                      </Button>
                      {post.is_deleted ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-green-600 border-green-200"
                          onClick={() => handleRestorePost(post)}>恢复</Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-500 border-red-200 hover:bg-red-50"
                          onClick={() => handleDeletePost(post)}>
                          <Trash2 className="w-3 h-3" />删除
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增板块弹窗 */}
      <Dialog open={catDialog} onOpenChange={o => { if (!o) setCatDialog(false); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>新增论坛板块</DialogTitle></DialogHeader>
          <form onSubmit={handleAddCategory} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">板块标识（英文，唯一）</Label>
              <Input value={catForm.key} onChange={e => setCatForm(f => ({ ...f, key: e.target.value }))}
                placeholder="如: career, research" className="h-10" maxLength={30} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">板块名称</Label>
              <Input value={catForm.label} onChange={e => setCatForm(f => ({ ...f, label: e.target.value }))}
                placeholder="如: 求职经验" className="h-10" maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">板块描述（可选）</Label>
              <Textarea value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                placeholder="板块简介…" rows={2} maxLength={100} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCatDialog(false)}>取消</Button>
              <Button type="submit" disabled={catSaving} className="bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5">
                {catSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}添加
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 管理员发帖弹窗 */}
      <Dialog open={postDialog} onOpenChange={o => { if (!o) setPostDialog(false); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>管理员发帖</DialogTitle></DialogHeader>
          <form onSubmit={handlePostAsAdmin} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">版块</Label>
              <Select value={postForm.category} onValueChange={v => setPostForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="选择版块" /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.is_active).map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">标题</Label>
              <Input value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value }))}
                placeholder="帖子标题（至少5个字）" className="h-10" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">内容</Label>
              <Textarea value={postForm.content} onChange={e => setPostForm(f => ({ ...f, content: e.target.value }))}
                placeholder="帖子内容…" rows={6} maxLength={5000} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPostDialog(false)}>取消</Button>
              <Button type="submit" disabled={postSaving} className="bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5">
                {postSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}发布
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
type AdminTab = 'stats' | 'users' | 'news' | 'activities' | 'classrooms' | 'moderation' | 'messages' | 'logs' | 'forum';

const adminNavItems: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: 'stats', label: '数据统计', icon: TrendingUp },
  { key: 'users', label: '用户管理', icon: Users },
  { key: 'forum', label: '论坛管理', icon: MessageSquare },
  { key: 'news', label: '校园资讯', icon: Newspaper },
  { key: 'activities', label: '社团活动', icon: Activity },
  { key: 'classrooms', label: '空教室', icon: DoorOpen },
  { key: 'moderation', label: '内容审核', icon: ShieldOff },
  { key: 'messages', label: '联系消息', icon: Mail },
  { key: 'logs', label: '操作日志', icon: ScrollText },
];

export default function AdminPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>
      </Layout>
    );
  }

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldOff className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-700">无访问权限</h2>
          <p className="text-gray-500 text-sm">仅管理员可访问此页面</p>
          <Button onClick={() => navigate('/')}>返回首页</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex gap-6 h-full min-h-[calc(100vh-8rem)]">
        {/* 后台侧边栏 */}
        <aside className="w-48 shrink-0 hidden md:block">
          <div className="bg-white border border-[#E5E6EB] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E6EB] bg-[#165DFF]/5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#165DFF]" />
                <span className="text-sm font-semibold text-[#165DFF]">管理后台</span>
              </div>
            </div>
            <nav className="py-2">
              {adminNavItems.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    activeTab === key ? 'bg-[#165DFF]/10 text-[#165DFF] font-medium' : 'text-gray-600 hover:bg-[#F5F7FA]'
                  }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* 移动端顶部选项卡 */}
        <div className="md:hidden w-full">
          <div className="flex gap-1 overflow-x-auto bg-white border border-[#E5E6EB] rounded-xl p-1 mb-4">
            {adminNavItems.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs shrink-0 transition-colors ${activeTab === key ? 'bg-[#165DFF] text-white' : 'text-gray-600'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 min-w-0">
          <Card className="border-[#E5E6EB] h-full">
            <CardHeader className="pb-3 border-b border-[#E5E6EB]">
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                {(() => { const item = adminNavItems.find(i => i.key === activeTab); return item ? <><item.icon className="w-4 h-4 text-[#165DFF]" />{item.label}</> : null; })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {activeTab === 'stats'       && <StatsPanel />}
              {activeTab === 'users'       && <UsersPanel />}
              {activeTab === 'forum'       && <ForumAdminPanel />}
              {activeTab === 'news'        && <NewsPanel />}
              {activeTab === 'activities'  && <ActivitiesPanel />}
              {activeTab === 'classrooms'  && <ClassroomsPanel />}
              {activeTab === 'moderation'  && <ContentModerationPanel />}
              {activeTab === 'messages'    && <ContactMessagesPanel />}
              {activeTab === 'logs'        && <AdminLogsPanel />}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
