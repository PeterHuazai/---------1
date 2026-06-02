import React, { useEffect, useState, useRef } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Course } from '@/types/types';
import { Plus, Clock, MapPin, Pencil, Trash2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import CourseImportDialog from '@/components/CourseImportDialog';
import { detectConflicts } from '@/utils/courseConflict';

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
const courseColors = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#722ED1', '#14C9C9', '#F7BA1E', '#3491FA'];

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showImport, setShowImport] = useState(false);
  // 冲突确认弹窗
  const [conflictDialog, setConflictDialog] = useState<{ open: boolean; names: string; payload: Record<string, unknown> }>({ open: false, names: '', payload: {} });
  const pendingPayloadRef = useRef<{ payload: Record<string, unknown>; isEdit: boolean; editId?: string } | null>(null);
  const [form, setForm] = useState({
    name: '', day_of_week: '0', start_time: '08:00', end_time: '09:35',
    location: '', teacher: '', credits: '', course_type: '必修',
    color: '#165DFF', start_week: '1', end_week: '20', reminder_minutes: '15', notes: ''
  });

  useEffect(() => {
    if (!user) return;
    fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user!.id)
      .order('start_time', { ascending: true });
    if (!error) setCourses(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: form.name,
      day_of_week: parseInt(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location,
      teacher: form.teacher || null,
      credits: form.credits ? parseFloat(form.credits) : null,
      course_type: form.course_type,
      color: form.color,
      start_week: parseInt(form.start_week),
      end_week: parseInt(form.end_week),
      reminder_minutes: parseInt(form.reminder_minutes),
      notes: form.notes || null,
    };

    // 课程时间冲突检测
    const conflicts = detectConflicts(
      { ...payload, name: form.name },
      courses,
      editingCourse?.id
    );
    if (conflicts.length > 0) {
      const names = conflicts.map(c => `《${c.name}》`).join('、');
      // 保存待提交数据，弹出确认弹窗
      pendingPayloadRef.current = { payload, isEdit: !!editingCourse, editId: editingCourse?.id };
      setConflictDialog({ open: true, names, payload });
      return;
    }

    await saveCourse(payload, !!editingCourse, editingCourse?.id);
  };

  // 实际保存逻辑（冲突确认后也复用此函数）
  const saveCourse = async (payload: Record<string, unknown>, isEdit: boolean, editId?: string) => {
    if (isEdit && editId) {
      const { error } = await supabase.from('courses').update(payload).eq('id', editId);
      if (error) { toast.error('更新失败'); return; }
      toast.success('课程更新成功');
    } else {
      const { error } = await supabase.from('courses').insert(payload);
      if (error) { toast.error('添加失败：' + error.message); return; }
      toast.success('课程添加成功');
    }
    setShowAdd(false);
    setEditingCourse(null);
    resetForm();
    fetchCourses();
  };

  const resetForm = () => {
    setForm({
      name: '', day_of_week: '0', start_time: '08:00', end_time: '09:35',
      location: '', teacher: '', credits: '', course_type: '必修',
      color: '#165DFF', start_week: '1', end_week: '20', reminder_minutes: '15', notes: ''
    });
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({
      name: course.name, day_of_week: String(course.day_of_week),
      start_time: course.start_time.slice(0, 5), end_time: course.end_time.slice(0, 5),
      location: course.location, teacher: course.teacher || '',
      credits: course.credits ? String(course.credits) : '', course_type: course.course_type || '必修',
      color: course.color || '#165DFF', start_week: String(course.start_week || 1),
      end_week: String(course.end_week || 20), reminder_minutes: String(course.reminder_minutes || 15),
      notes: course.notes || ''
    });
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这门课程吗？')) return;
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) { toast.error('删除失败'); return; }
    toast.success('删除成功');
    fetchCourses();
  };

  const handleDeleteAll = async () => {
    if (!user || courses.length === 0) return;
    if (!confirm(`确定要删除全部 ${courses.length} 门课程吗？此操作不可恢复！`)) return;
    const { error } = await supabase.from('courses').delete().eq('user_id', user.id);
    if (error) { toast.error('删除失败：' + error.message); return; }
    toast.success('已清空所有课程');
    fetchCourses();
  };

  const getCoursePosition = (course: Course) => {
    const startHour = parseInt(course.start_time.split(':')[0]);
    const startMin = parseInt(course.start_time.split(':')[1]);
    const endHour = parseInt(course.end_time.split(':')[0]);
    const endMin = parseInt(course.end_time.split(':')[1]);
    const top = (startHour - 8) * 64 + (startMin / 60) * 64;
    const height = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * 64;
    return { top, height };
  };

  return (
    <Layout>
      {/* 课程冲突确认弹窗 */}
      <AlertDialog open={conflictDialog.open} onOpenChange={open => !open && setConflictDialog(d => ({ ...d, open: false }))}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />时间冲突提醒
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 leading-relaxed">
              该课程与 <span className="font-semibold text-gray-900">{conflictDialog.names}</span> 的上课时间存在重叠。
              <br className="my-1" />
              你可以选择<strong>强制保存</strong>（冲突课程将保留，日历上会显示重叠）或返回重新调整时间。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回修改</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={async () => {
                setConflictDialog(d => ({ ...d, open: false }));
                const p = pendingPayloadRef.current;
                if (p) await saveCourse(p.payload, p.isEdit, p.editId);
              }}
            >
              强制保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-2 justify-between">
          <h1 className="text-xl font-bold text-gray-900">课程表</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditingCourse(null); resetForm(); setShowAdd(true); }} className="bg-[#165DFF] hover:bg-[#165DFF]/90">
              <Plus className="w-4 h-4 mr-1" /> 添加课程
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> 导入课表
            </Button>
            {courses.length > 0 && (
              <Button variant="outline" onClick={handleDeleteAll}
                className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300">
                <Trash2 className="w-4 h-4 mr-1" /> 清空课表
              </Button>
            )}
          </div>
        </div>

        {/* 周视图 */}
        <div className="bg-white rounded-xl border border-[#E5E6EB] overflow-hidden overflow-x-auto">
          <div className="min-w-[800px]">
            {/* 表头 */}
            <div className="grid grid-cols-8 border-b border-[#E5E6EB]">
              <div className="p-3 text-center text-sm font-medium text-gray-500 border-r border-[#E5E6EB] bg-gray-50">时间</div>
              {weekDays.map((day, i) => (
                <div key={i} className={`p-3 text-center text-sm font-medium ${new Date().getDay() === (i + 1) % 7 ? 'text-[#165DFF] bg-[#165DFF]/5' : 'text-gray-700'}`}>
                  {day}
                </div>
              ))}
            </div>
            {/* 课程网格 */}
            <div className="relative" style={{ height: '896px' }}>
              {timeSlots.map((slot, i) => (
                <div key={i} className="absolute w-full border-b border-[#E5E6EB]/50 flex" style={{ top: i * 64, height: 64 }}>
                  <div className="w-[12.5%] text-center text-xs text-gray-400 py-1 border-r border-[#E5E6EB] bg-gray-50/50">{slot}</div>
                  <div className="w-[87.5%] grid grid-cols-7" />
                </div>
              ))}
              {/* 课程卡片 */}
              {courses.map((course) => {
                const pos = getCoursePosition(course);
                return (
                  <div
                    key={course.id}
                    className="absolute rounded-lg p-2 text-xs cursor-pointer hover:shadow-md transition-shadow border border-white/20 overflow-hidden"
                    style={{
                      left: `${12.5 + course.day_of_week * 12.5}%`,
                      width: '12.5%',
                      top: pos.top,
                      height: Math.max(pos.height, 40),
                      backgroundColor: course.color || '#165DFF',
                      color: '#fff',
                    }}
                    onClick={() => handleEdit(course)}
                    title={`${course.name} ${course.start_time.slice(0,5)}-${course.end_time.slice(0,5)} ${course.location}`}
                  >
                    <div className="font-medium truncate">{course.name}</div>
                    <div className="opacity-90 truncate">{course.location}</div>
                    <div className="opacity-75 truncate">{course.start_time.slice(0,5)}-{course.end_time.slice(0,5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 课程列表 */}
        <div className="bg-white rounded-xl border border-[#E5E6EB] p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">课程列表</h2>
          <div className="space-y-2">
            {courses.map((course) => (
              <div key={course.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E6EB] hover:bg-gray-50">
                <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: course.color || '#165DFF' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{course.name}</div>
                  <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                    <span>{weekDays[course.day_of_week]} {course.start_time.slice(0,5)}-{course.end_time.slice(0,5)}</span>
                    <span>{course.location}</span>
                    {course.teacher && <span>{course.teacher}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleEdit(course)} className="p-1.5 rounded hover:bg-gray-100"><Pencil className="w-4 h-4 text-gray-500" /></button>
                  <button onClick={() => handleDelete(course.id)} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </div>
              </div>
            ))}
            {courses.length === 0 && <p className="text-sm text-gray-400 text-center py-4">暂无课程，点击右上角添加</p>}
          </div>
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? '编辑课程' : '添加课程'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>课程名称 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>星期 *</Label>
                <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weekDays.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>课程类型</Label>
                <Select value={form.course_type} onValueChange={(v) => setForm({ ...form, course_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="必修">必修</SelectItem>
                    <SelectItem value="选修">选修</SelectItem>
                    <SelectItem value="通识">通识</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>开始时间 *</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div>
                <Label>结束时间 *</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>上课地点 *</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>任课老师</Label>
                <Input value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
              </div>
              <div>
                <Label>学分</Label>
                <Input type="number" step="0.5" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>开始周</Label>
                <Input type="number" value={form.start_week} onChange={(e) => setForm({ ...form, start_week: e.target.value })} />
              </div>
              <div>
                <Label>结束周</Label>
                <Input type="number" value={form.end_week} onChange={(e) => setForm({ ...form, end_week: e.target.value })} />
              </div>
              <div>
                <Label>提醒(分钟)</Label>
                <Select value={form.reminder_minutes} onValueChange={(v) => setForm({ ...form, reminder_minutes: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">不提醒</SelectItem>
                    <SelectItem value="15">15分钟</SelectItem>
                    <SelectItem value="30">30分钟</SelectItem>
                    <SelectItem value="60">1小时</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>颜色</Label>
              <div className="flex gap-2 mt-1">
                {courseColors.map((c) => (
                  <button key={c} type="button"
                    className={`w-7 h-7 rounded-full border-2 ${form.color === c ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 bg-[#165DFF] hover:bg-[#165DFF]/90">{editingCourse ? '更新' : '添加'}</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingCourse(null); }}>取消</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 导入课表弹窗 */}
      <CourseImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={fetchCourses}
        existingCourses={courses}
      />
    </Layout>
  );
}
