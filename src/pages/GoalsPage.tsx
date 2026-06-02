import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Goal, Checkin } from '@/types/types';
import {
  Plus, CheckCircle2, Flame, Calendar, BarChart3, Pencil, Trash2,
  BookOpen, Dumbbell, Sun, Target, X, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const categoryIcons: Record<string, React.ReactNode> = {
  '学习': <BookOpen className="w-5 h-5 text-[#165DFF]" />,
  '运动': <Dumbbell className="w-5 h-5 text-orange-500" />,
  '生活': <Sun className="w-5 h-5 text-yellow-500" />,
  '其他': <Target className="w-5 h-5 text-purple-500" />,
};

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

// ─────────────────────────────────────────────────────────────
// 打卡热力日历（90天方格图）
// ─────────────────────────────────────────────────────────────
interface HeatmapProps {
  goalCheckins: Checkin[];
}

interface CellInfo {
  date: string; // YYYY-MM-DD
  state: 'checked' | 'missed' | 'future' | 'today-unchecked';
  checkin?: Checkin;
}

function CheckinHeatmap({ goalCheckins }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<CellInfo | null>(null);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 91>(91);

  // 根据所选范围构建格子数据（7→7天单行, 30→30天单行, 91→13周×7天网格）
  const cells: CellInfo[] = (() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const checkinMap = new Map(goalCheckins.map(c => [c.checkin_date, c]));
    const result: CellInfo[] = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const isToday = ds === todayStr;
      const isPast = ds < todayStr;
      if (checkinMap.has(ds)) {
        result.push({ date: ds, state: 'checked', checkin: checkinMap.get(ds) });
      } else if (isToday) {
        result.push({ date: ds, state: 'today-unchecked' });
      } else if (isPast) {
        result.push({ date: ds, state: 'missed' });
      } else {
        result.push({ date: ds, state: 'future' });
      }
    }
    return result;
  })();

  // 91天模式按7天分列（周网格）；7/30天模式单行展示
  const useGrid = rangeDays === 91;
  const weeks: CellInfo[][] = useGrid
    ? Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) => cells.slice(i * 7, i * 7 + 7))
    : [cells];

  const checkedCount = cells.filter(c => c.state === 'checked').length;
  const missedCount = cells.filter(c => c.state === 'missed').length;
  const rate = cells.filter(c => c.state !== 'future').length > 0
    ? Math.round(checkedCount / cells.filter(c => c.state !== 'future').length * 100)
    : 0;

  return (
    <div className="mt-4">
      {/* 日期范围切换 + 统计 */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1">
          {([7, 30, 91] as const).map(d => (
            <button key={d} onClick={() => { setRangeDays(d); setTooltip(null); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                rangeDays === d ? 'bg-[#165DFF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {d === 7 ? '近7天' : d === 30 ? '近30天' : '近3月'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          打卡 <span className="text-[#165DFF] font-semibold">{checkedCount}</span> 天 ·
          未打卡 <span className="text-red-400 font-semibold">{missedCount}</span> 天 ·
          完成率 <span className="font-semibold text-gray-600">{rate}%</span>
        </span>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#165DFF]" />已打卡</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-300" />未打卡</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border-2 border-[#165DFF] bg-white" />今天</div>
      </div>

      {/* 方格网格 */}
      <div className="overflow-x-auto">
        <div className={`flex ${useGrid ? 'gap-0.5' : 'gap-1 flex-wrap'} min-w-0`}
          style={{ minWidth: useGrid ? `${weeks.length * 18}px` : undefined }}>
          {/* 周一～日标签列（仅91天模式） */}
          {useGrid && (
            <div className="flex flex-col gap-0.5 mr-1 shrink-0">
              {WEEK_LABELS.map(d => (
                <div key={d} className="w-4 h-4 flex items-center justify-center text-[10px] text-gray-400">{d}</div>
              ))}
            </div>
          )}
          {/* 数据列 */}
          {weeks.map((week, wi) => (
            <div key={wi} className={`flex ${useGrid ? 'flex-col gap-0.5' : 'contents'}`}>
              {week.map((cell, di) => {
                let bg = '';
                let border = '';
                let title = '';
                if (cell.state === 'checked') {
                  bg = 'bg-[#165DFF]';
                  title = `${cell.date} ✅ 已打卡${cell.checkin?.duration_minutes ? ` · ${cell.checkin.duration_minutes}分钟` : ''}${cell.checkin?.notes ? ` · ${cell.checkin.notes}` : ''}`;
                } else if (cell.state === 'missed') {
                  bg = 'bg-red-300';
                  title = `${cell.date} ❌ 未打卡`;
                } else if (cell.state === 'today-unchecked') {
                  bg = 'bg-white';
                  border = 'border-2 border-[#165DFF]';
                  title = `${cell.date} 今天（未打卡）`;
                } else {
                  bg = 'bg-gray-100';
                  border = 'border border-gray-200';
                  title = cell.date;
                }
                return (
                  <div key={`${wi}-${di}`}
                    className={`rounded-sm cursor-pointer transition-opacity hover:opacity-75 ${bg} ${border} ${useGrid ? 'w-4 h-4' : 'w-5 h-5'}`}
                    title={title}
                    onClick={() => setTooltip(tooltip?.date === cell.date ? null : cell)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 点击详情气泡 */}
      {tooltip && (
        <div className={`mt-3 rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${
          tooltip.state === 'checked' ? 'bg-[#165DFF]/5 border-[#165DFF]/20 text-gray-800'
          : tooltip.state === 'missed' ? 'bg-red-50 border-red-200 text-gray-800'
          : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}>
          <div className={`w-3 h-3 rounded-sm mt-0.5 shrink-0 ${
            tooltip.state === 'checked' ? 'bg-[#165DFF]'
            : tooltip.state === 'missed' ? 'bg-red-300'
            : 'bg-gray-200'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium">
              {tooltip.date}&nbsp;
              {tooltip.state === 'checked' && '✅ 已打卡'}
              {tooltip.state === 'missed' && '❌ 未打卡（过去）'}
              {tooltip.state === 'today-unchecked' && '📍 今天'}
              {tooltip.state === 'future' && '⏳ 未来'}
            </p>
            {tooltip.checkin && (
              <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                {tooltip.checkin.duration_minutes > 0 && <p>⏱ 学习时长：{tooltip.checkin.duration_minutes} 分钟</p>}
                {tooltip.checkin.notes && <p>📝 备注：{tooltip.checkin.notes}</p>}
              </div>
            )}
          </div>
          <button onClick={() => setTooltip(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkins, setCheckins] = useState<Record<string, Checkin[]>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [showCheckin, setShowCheckin] = useState<Goal | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const [checkinDuration, setCheckinDuration] = useState('');
  const [activeTab, setActiveTab] = useState<'goals' | 'stats'>('goals');
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', period: '每日', target_value: '1', unit: '次', category: '学习'
  });

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user) return;
    fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    const { data } = await supabase.from('goals').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    setGoals(data || []);
    if (data) fetchCheckins(data.map((g: Goal) => g.id));
  };

  const fetchCheckins = async (goalIds: string[]) => {
    if (!goalIds.length) return;
    const { data } = await supabase.from('checkins').select('*').in('goal_id', goalIds).eq('user_id', user!.id).order('checkin_date', { ascending: false });
    if (data) {
      const map: Record<string, Checkin[]> = {};
      data.forEach((c: Checkin) => {
        if (!map[c.goal_id]) map[c.goal_id] = [];
        map[c.goal_id].push(c);
      });
      setCheckins(map);
    }
  };

  const getStreak = (goalCheckins: Checkin[]) => {
    if (!goalCheckins?.length) return 0;
    let streak = 0;
    const dates = goalCheckins.map(c => c.checkin_date).sort().reverse();
    let current = new Date(today);
    for (const d of dates) {
      const diff = (current.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 1) { streak++; current = new Date(d); } else break;
    }
    return streak;
  };

  const hasTodayCheckin = (goalId: string) => (checkins[goalId] || []).some(c => c.checkin_date === today);

  const handleCheckin = async () => {
    if (!user || !showCheckin) return;
    const duration = checkinDuration ? parseInt(checkinDuration) : 0;
    if (duration < 0) { toast.error('学习时长不能为负数'); return; }
    const { error } = await supabase.from('checkins').insert({
      goal_id: showCheckin.id,
      user_id: user.id,
      checkin_date: today,
      notes: checkinNote || null,
      duration_minutes: duration,
    });
    if (error) { toast.error('打卡失败'); return; }
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: '打卡成功',
      content: `你完成了「${showCheckin.name}」的今日打卡！`,
      type: '系统通知',
    });
    toast.success('打卡成功！');
    setShowCheckin(null);
    setCheckinNote('');
    setCheckinDuration('');
    fetchGoals();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const targetVal = parseInt(form.target_value);
    if (!targetVal || targetVal < 1) { toast.error('目标值必须大于 0'); return; }
    const payload = {
      user_id: user.id,
      name: form.name,
      description: form.description || null,
      period: form.period,
      target_value: targetVal,
      unit: form.unit,
      category: form.category,
    };
    if (editingGoal) {
      const { error } = await supabase.from('goals').update(payload).eq('id', editingGoal.id);
      if (error) { toast.error('更新失败'); return; }
      toast.success('目标更新成功');
    } else {
      const { error } = await supabase.from('goals').insert(payload);
      if (error) { toast.error('添加失败'); return; }
      toast.success('目标添加成功');
    }
    setShowAdd(false);
    setEditingGoal(null);
    resetForm();
    fetchGoals();
  };

  const resetForm = () => setForm({ name: '', description: '', period: '每日', target_value: '1', unit: '次', category: '学习' });

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({ name: goal.name, description: goal.description || '', period: goal.period, target_value: String(goal.target_value), unit: goal.unit, category: goal.category });
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该目标？')) return;
    await supabase.from('goals').delete().eq('id', id);
    toast.success('删除成功');
    fetchGoals();
  };

  const totalCheckins = Object.values(checkins).flat().length;
  const thisWeekCheckins = Object.values(checkins).flat().filter(c => {
    const d = new Date(c.checkin_date);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return d >= weekStart;
  }).length;
  const totalMinutes = Object.values(checkins).flat().reduce((sum, c) => sum + (c.duration_minutes || 0), 0);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* 页头 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">学习打卡</h1>
            <p className="text-sm text-gray-500 mt-0.5">坚持每日打卡，养成高效学习习惯</p>
          </div>
          <div className="flex gap-2">
            <div className="flex bg-white border border-[#E5E6EB] rounded-xl overflow-hidden">
              <button
                onClick={() => setActiveTab('goals')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'goals' ? 'bg-[#165DFF] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >目标列表</button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'stats' ? 'bg-[#165DFF] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >统计报告</button>
            </div>
            <Button
              onClick={() => { setEditingGoal(null); resetForm(); setShowAdd(true); }}
              className="bg-[#165DFF] hover:bg-[#165DFF]/90 gap-1.5"
            >
              <Plus className="w-4 h-4" />添加目标
            </Button>
          </div>
        </div>

        {/* 目标列表 Tab */}
        {activeTab === 'goals' && (
          <div className="space-y-4">
            {goals.length === 0 && (
              <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-[#E5E6EB]">
                <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">暂无打卡目标</p>
                <p className="text-sm mt-1">点击「添加目标」创建你的第一个学习目标</p>
              </div>
            )}
            {goals.map((goal) => {
              const streak = getStreak(checkins[goal.id] || []);
              const done = hasTodayCheckin(goal.id);
              const totalForGoal = (checkins[goal.id] || []).length;
              const expanded = expandedGoal === goal.id;

              return (
                <div key={goal.id} className="bg-white rounded-2xl border border-[#E5E6EB] overflow-hidden shadow-sm">
                  {/* 目标头部 */}
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#165DFF]/10 flex items-center justify-center shrink-0">
                        {categoryIcons[goal.category] || <Target className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{goal.period}</Badge>
                              <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{goal.category}</Badge>
                              <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">目标 {goal.target_value}{goal.unit}</Badge>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => handleEdit(goal)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                            <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                        {goal.description && <p className="text-xs text-gray-400 mt-2">{goal.description}</p>}

                        {/* 数据行 */}
                        <div className="flex items-center gap-5 mt-3">
                          <div className="flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="font-bold text-gray-800">{streak}</span>
                            <span className="text-xs text-gray-400">天连续</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-[#165DFF]" />
                            <span className="font-bold text-gray-800">{totalForGoal}</span>
                            <span className="text-xs text-gray-400">次打卡</span>
                          </div>
                          {/* 展开热力图按钮 */}
                          <button
                            onClick={() => setExpandedGoal(expanded ? null : goal.id)}
                            className="ml-auto flex items-center gap-1 text-xs text-[#165DFF] hover:underline"
                          >
                            {expanded ? <><ChevronUp className="w-3.5 h-3.5" />收起日历</> : <><ChevronDown className="w-3.5 h-3.5" />查看日历</>}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 打卡按钮 */}
                    <div className="mt-4">
                      {done ? (
                        <div className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-green-50 text-green-700 text-sm font-medium">
                          <CheckCircle2 className="w-5 h-5" />今日已打卡，继续保持！
                        </div>
                      ) : (
                        <Button
                          onClick={() => setShowCheckin(goal)}
                          className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 h-10"
                        >
                          立即打卡
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 展开：热力日历 */}
                  {expanded && (
                    <div className="border-t border-[#E5E6EB] bg-[#FAFBFF] px-5 py-4">
                      <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                        <Info className="w-4 h-4 text-[#165DFF]" />近 91 天打卡记录
                      </p>
                      <CheckinHeatmap goalCheckins={checkins[goal.id] || []} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 统计 Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '累计打卡', value: totalCheckins, unit: '次', color: 'text-[#165DFF]' },
                { label: '本周打卡', value: thisWeekCheckins, unit: '次', color: 'text-green-600' },
                { label: '累计时长', value: Math.round(totalMinutes / 60), unit: '小时', color: 'text-orange-500' },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#E5E6EB] p-5 text-center shadow-sm">
                  <p className={`text-3xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{unit}</p>
                  <p className="text-sm text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E6EB] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">各目标打卡情况</h2>
              <div className="space-y-4">
                {goals.map((goal) => {
                  const count = (checkins[goal.id] || []).length;
                  const maxCount = Math.max(...goals.map(g => (checkins[g.id] || []).length), 1);
                  const streak = getStreak(checkins[goal.id] || []);
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">{goal.name}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" />{streak}天连续</span>
                          <span className="text-[#165DFF] font-semibold">{count} 次</span>
                        </div>
                      </div>
                      <Progress value={(count / maxCount) * 100} className="h-2.5" />
                    </div>
                  );
                })}
                {goals.length === 0 && <p className="text-sm text-gray-400 text-center py-6">暂无数据，快去添加目标并打卡吧</p>}
              </div>
            </div>

            {/* 各目标的热力图（统计页也展示） */}
            {goals.map(goal => (
              <div key={goal.id} className="bg-white rounded-2xl border border-[#E5E6EB] p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#165DFF]/10 flex items-center justify-center">
                    {categoryIcons[goal.category] || <Target className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{goal.name}</p>
                    <p className="text-xs text-gray-400">近 91 天打卡热力图</p>
                  </div>
                </div>
                <CheckinHeatmap goalCheckins={checkins[goal.id] || []} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 打卡弹窗 */}
      <Dialog open={!!showCheckin} onOpenChange={() => setShowCheckin(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#165DFF]/10 flex items-center justify-center">
                {showCheckin && (categoryIcons[showCheckin.category] || <Target className="w-4 h-4" />)}
              </div>
              打卡：{showCheckin?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>学习时长（分钟）</Label>
              <Input type="number" min="0" value={checkinDuration} onChange={(e) => setCheckinDuration(e.target.value)} placeholder="可选，如 60" />
            </div>
            <div className="space-y-1.5">
              <Label>学习备注（可选）</Label>
              <Input value={checkinNote} onChange={(e) => setCheckinNote(e.target.value)} placeholder="今天的学习心得..." />
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={handleCheckin} className="flex-1 bg-[#165DFF] hover:bg-[#165DFF]/90">完成打卡</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowCheckin(null)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 添加/编辑目标弹窗 */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>{editingGoal ? '编辑目标' : '添加目标'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>目标名称 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="如: 每日背单词" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>目标周期</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="每日">每日</SelectItem>
                    <SelectItem value="每周">每周</SelectItem>
                    <SelectItem value="每月">每月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>分类</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="学习">学习</SelectItem>
                    <SelectItem value="运动">运动</SelectItem>
                    <SelectItem value="生活">生活</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>目标值</Label>
                <Input type="number" min="1" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>单位</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如: 次、小时" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="目标描述" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" className="flex-1 bg-[#165DFF] hover:bg-[#165DFF]/90">{editingGoal ? '更新' : '添加'}</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingGoal(null); }}>取消</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
