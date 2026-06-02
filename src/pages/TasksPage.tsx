import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Task, Course } from '@/types/types';
import { Plus, Pencil, Trash2, CalendarDays, Filter, CheckCircle2, Circle, Clock, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    course_id: '', name: '', type: '作业', due_date: '', due_time: '23:59',
    submit_method: '', weight: '', notes: '',
    reminder_3d: false, reminder_1d: false, reminder_1h: false
  });

  useEffect(() => {
    if (!user) return;
    fetchTasks();
    fetchCourses();
  }, [user, filterType, filterStatus]);

  const fetchTasks = async () => {
    let query = supabase
      .from('tasks')
      .select('*, courses(name)')
      .eq('user_id', user!.id)
      .order('due_date', { ascending: true });

    if (filterType !== 'all') query = query.eq('type', filterType);
    if (filterStatus === 'active') query = query.in('status', ['未开始', '进行中']);
    else if (filterStatus === 'completed') query = query.eq('status', '已完成');
    else if (filterStatus === 'expired') query = query.eq('status', '已过期');

    const { data, error } = await query;
    if (!error) {
      const mapped = (data || []).map((t: any) => ({ ...t, course_name: t.courses?.name }));
      setTasks(mapped);
    }
  };

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('user_id', user!.id);
    setCourses(data || []);
  };

  const getUrgency = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    const hours = diff / (1000 * 60 * 60);
    if (hours <= 0) return { color: 'bg-gray-100 text-gray-500 border-gray-200', label: '已过期' };
    if (hours <= 24) return { color: 'bg-red-50 text-red-600 border-red-200', label: '24小时内' };
    if (hours <= 168) return { color: 'bg-yellow-50 text-yellow-600 border-yellow-200', label: '7天内' };
    return { color: 'bg-gray-50 text-gray-500 border-gray-200', label: '7天以上' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const due = new Date(form.due_date + 'T' + form.due_time);
    const payload = {
      user_id: user.id,
      course_id: form.course_id || null,
      name: form.name,
      type: form.type,
      due_date: due.toISOString(),
      submit_method: form.submit_method || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      notes: form.notes || null,
      reminder_3d: form.reminder_3d,
      reminder_1d: form.reminder_1d,
      reminder_1h: form.reminder_1h,
    };

    if (editingTask) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
      if (error) { toast.error('更新失败'); return; }
      toast.success('任务更新成功');
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) { toast.error('添加失败'); return; }
      toast.success('任务添加成功');
    }
    setShowAdd(false);
    setEditingTask(null);
    resetForm();
    fetchTasks();
  };

  const resetForm = () => {
    setForm({
      course_id: '', name: '', type: '作业', due_date: '', due_time: '23:59',
      submit_method: '', weight: '', notes: '',
      reminder_3d: false, reminder_1d: false, reminder_1h: false
    });
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    const due = new Date(task.due_date);
    setForm({
      course_id: task.course_id || '', name: task.name, type: task.type,
      due_date: due.toISOString().slice(0, 10), due_time: due.toTimeString().slice(0, 5),
      submit_method: task.submit_method || '', weight: task.weight ? String(task.weight) : '',
      notes: task.notes || '',
      reminder_3d: task.reminder_3d, reminder_1d: task.reminder_1d, reminder_1h: task.reminder_1h
    });
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该任务？')) return;
    await supabase.from('tasks').delete().eq('id', id);
    toast.success('删除成功');
    fetchTasks();
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    fetchTasks();
  };

  const filteredTasks = tasks.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">作业与考试</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Input placeholder="搜索任务" value={search} onChange={(e) => setSearch(e.target.value)} className="w-40 h-9" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="作业">作业</SelectItem>
                <SelectItem value="实验报告">实验报告</SelectItem>
                <SelectItem value="课程论文">课程论文</SelectItem>
                <SelectItem value="期末考试">期末考试</SelectItem>
                <SelectItem value="随堂测验">随堂测验</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">进行中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="expired">已过期</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingTask(null); resetForm(); setShowAdd(true); }} className="bg-[#165DFF] hover:bg-[#165DFF]/90 h-9">
              <Plus className="w-4 h-4 mr-1" /> 添加
            </Button>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="bg-white rounded-xl border border-[#E5E6EB] overflow-hidden">
          <div className="divide-y divide-[#E5E6EB]">
            {filteredTasks.map((task) => {
              const urgency = getUrgency(task.due_date);
              const due = new Date(task.due_date);
              return (
                <div key={task.id} className="p-4 hover:bg-gray-50 flex items-start gap-3">
                  <button onClick={() => handleStatusChange(task, task.status === '已完成' ? '未开始' : '已完成')} className="mt-0.5">
                    {task.status === '已完成' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 hover:text-[#165DFF]" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${task.status === '已完成' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${urgency.color}`}>{urgency.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
                      {task.course_name && <span className="text-xs text-gray-500">{task.course_name}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />截止 {due.toLocaleDateString('zh-CN')} {due.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                      {task.weight && <span>占比 {task.weight}%</span>}
                      {task.submit_method && <span>提交方式: {task.submit_method}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(task)} className="p-1.5 rounded hover:bg-gray-100"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </div>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>暂无任务</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editingTask ? '编辑任务' : '添加任务'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>对应课程</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="选择课程" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>任务类型 *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="作业">作业</SelectItem>
                    <SelectItem value="实验报告">实验报告</SelectItem>
                    <SelectItem value="课程论文">课程论文</SelectItem>
                    <SelectItem value="期末考试">期末考试</SelectItem>
                    <SelectItem value="随堂测验">随堂测验</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>任务名称 *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>截止日期 *</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
              </div>
              <div>
                <Label>截止时间</Label>
                <Input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>提交方式</Label>
                <Input value={form.submit_method} onChange={(e) => setForm({ ...form, submit_method: e.target.value })} placeholder="如: 线上提交" />
              </div>
              <div>
                <Label>成绩占比(%)</Label>
                <Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>提醒设置</Label>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="r3d" checked={form.reminder_3d} onCheckedChange={(v) => setForm({ ...form, reminder_3d: v as boolean })} />
                  <label htmlFor="r3d" className="text-sm text-gray-600">截止前3天</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="r1d" checked={form.reminder_1d} onCheckedChange={(v) => setForm({ ...form, reminder_1d: v as boolean })} />
                  <label htmlFor="r1d" className="text-sm text-gray-600">截止前1天</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="r1h" checked={form.reminder_1h} onCheckedChange={(v) => setForm({ ...form, reminder_1h: v as boolean })} />
                  <label htmlFor="r1h" className="text-sm text-gray-600">截止前1小时</label>
                </div>
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 bg-[#165DFF] hover:bg-[#165DFF]/90">{editingTask ? '更新' : '添加'}</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingTask(null); }}>取消</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
