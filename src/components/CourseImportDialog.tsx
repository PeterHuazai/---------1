import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseSheetData, type ParsedCourse } from '@/utils/courseImport';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { detectConflicts, type ConflictTarget } from '@/utils/courseConflict';

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  existingCourses?: ConflictTarget[];
}

export default function CourseImportDialog({ open, onOpenChange, onImported, existingCourses = [] }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [courses, setCourses] = useState<ParsedCourse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  // 计算每条解析课程与已有课程的冲突（含导入列表内部相互冲突）
  const getConflictInfo = (idx: number): string[] => {
    const c = courses[idx];
    if (!c) return [];

    // 与已存在课程的冲突
    const existConflicts = detectConflicts(c, existingCourses);

    // 与导入列表中其他已选中课程的冲突（内部相互冲突）
    const internalConflicts = courses
      .filter((other, i) => i !== idx && selected.has(i) && selected.has(idx))
      .filter(other => {
        if (other.day_of_week !== c.day_of_week) return false;
        const s1 = c.start_time.split(':').map(Number);
        const e1 = c.end_time.split(':').map(Number);
        const s2 = other.start_time.split(':').map(Number);
        const e2 = other.end_time.split(':').map(Number);
        const s1m = s1[0] * 60 + s1[1], e1m = e1[0] * 60 + e1[1];
        const s2m = s2[0] * 60 + s2[1], e2m = e2[0] * 60 + e2[1];
        return s1m < e2m && s2m < e1m;
      });

    return [
      ...existConflicts.map(x => x.name),
      ...internalConflicts.map(x => x.name),
    ];
  };

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setCourses([]);
    setSelected(new Set());
    setErrorMsg('');
    setImporting(false);
    setImportedCount(0);
  };

  const handleFile = useCallback((file: File) => {
    setErrorMsg('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xls', 'xlsx', 'csv'].includes(ext || '')) {
      setErrorMsg('仅支持 .xls、.xlsx、.csv 格式的文件');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', codepage: 936 });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // 转为二维数组，保留原始文本（含换行）
        const rows: string[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1, defval: '', raw: false
        }) as string[][];

        const parsed = parseSheetData(rows);
        if (parsed.length === 0) {
          setErrorMsg('未能识别课程数据，请检查文件格式是否正确');
          return;
        }
        setCourses(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setStep('preview');
      } catch {
        setErrorMsg('文件解析失败，请检查文件是否损坏或格式不正确');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === courses.length) setSelected(new Set());
    else setSelected(new Set(courses.map((_, i) => i)));
  };

  const handleImport = async () => {
    if (!user || selected.size === 0) return;
    setImporting(true);

    // 过滤掉与已有课程有冲突的条目，只导入无冲突的
    const selectedCourses = courses.filter((_, i) => selected.has(i));

    // 逐项检查与已有课程的冲突（不做列表内部相互检查，取第一个无冲突）
    const nonConflicting: typeof selectedCourses = [];
    const conflictingNames: string[] = [];

    for (const c of selectedCourses) {
      // 与已存在课程冲突
      const existConflicts = detectConflicts(c, existingCourses);
      // 与本批次已准备导入的课程冲突
      const batchConflicts = detectConflicts(c, nonConflicting);
      if (existConflicts.length > 0 || batchConflicts.length > 0) {
        conflictingNames.push(c.name);
      } else {
        nonConflicting.push(c);
      }
    }

    if (nonConflicting.length === 0) {
      setImporting(false);
      const nameList = conflictingNames.slice(0, 3).map(n => `《${n}》`).join('、');
      toast.error(`所有选中课程均存在时间冲突（${nameList}${conflictingNames.length > 3 ? '等' : ''}），无法导入`, { duration: 6000 });
      return;
    }

    const toInsert = nonConflicting.map(c => ({
      user_id: user.id,
      name: c.name,
      day_of_week: c.day_of_week,
      start_time: c.start_time,
      end_time: c.end_time,
      location: c.location,
      teacher: c.teacher,
      course_type: c.course_type,
      start_week: c.start_week,
      end_week: c.end_week,
      color: c.color,
      notes: c.notes,
      credits: c.credits,
      reminder_minutes: 15,
    }));

    const { error } = await supabase.from('courses').insert(toInsert);
    setImporting(false);
    if (error) {
      toast.error('导入失败：' + error.message);
      return;
    }

    setImportedCount(nonConflicting.length);
    setStep('done');

    if (conflictingNames.length > 0) {
      const nameList = conflictingNames.slice(0, 3).map(n => `《${n}》`).join('、');
      toast.warning(
        `成功导入 ${nonConflicting.length} 门课程，跳过 ${conflictingNames.length} 门冲突课程（${nameList}${conflictingNames.length > 3 ? '等' : ''}）`,
        { duration: 8000 }
      );
    } else {
      toast.success(`成功导入 ${nonConflicting.length} 门课程`);
    }
    onImported();
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#165DFF]" />
            导入课表文件
          </DialogTitle>
          <DialogDescription>
            支持 .xls、.xlsx、.csv 格式，可识别学校标准课表格式或自定义列表格式
          </DialogDescription>
        </DialogHeader>

        {/* 上传步骤 */}
        {step === 'upload' && (
          <div className="flex-1 space-y-4 py-2">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-[#165DFF] bg-[#165DFF]/5' : 'border-gray-200 hover:border-[#165DFF]/60'}`}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input id="file-input" type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleInputChange} />
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">拖拽文件到此处上传</p>
              <p className="text-sm text-gray-400 mt-1">或点击选择文件</p>
              <p className="text-xs text-gray-300 mt-3">支持 .xls .xlsx .csv</p>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* 格式说明 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-gray-600">支持的格式说明</p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>· <span className="font-medium text-gray-700">学校标准课表格式</span>：行为节次（第一二节/第三四节…），列为星期，单元格包含课程名、教师、地点</p>
                <p>· <span className="font-medium text-gray-700">自定义列表格式</span>：每行一门课，包含列名：课程名、星期、开始时间、结束时间、地点、教师等</p>
              </div>
            </div>
          </div>
        )}

        {/* 预览步骤 */}
        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileSpreadsheet className="w-4 h-4 text-[#165DFF]" />
                <span className="truncate max-w-[200px]">{fileName}</span>
                <Badge variant="outline" className="text-xs">{courses.length} 门课程</Badge>
              </div>
              <button
                onClick={toggleAll}
                className="text-xs text-[#165DFF] hover:underline"
              >
                {selected.size === courses.length ? '取消全选' : '全选'}（{selected.size}/{courses.length}）
              </button>
            </div>

            {/* 冲突提示横幅 */}
            {courses.some((_, i) => selected.has(i) && getConflictInfo(i).length > 0) && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  带 <span className="font-semibold text-amber-600">冲突</span> 标记的课程将在导入时被自动跳过，不会写入课程表。
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {courses.map((course, i) => {
                const conflictNames = getConflictInfo(i);
                const hasConflict = conflictNames.length > 0;
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selected.has(i) ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                      className="mt-0.5 rounded"
                    />
                    <div className="w-2.5 h-full min-h-[2.5rem] rounded-full shrink-0 mt-0.5" style={{ backgroundColor: course.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{course.name}</span>
                        <Badge variant="outline" className="text-[10px]">{weekDays[course.day_of_week]}</Badge>
                        <span className="text-xs text-gray-500">{course.start_time}–{course.end_time}</span>
                        {hasConflict && (
                          <Badge className="bg-red-50 text-red-500 border border-red-200 text-[10px] flex items-center gap-0.5 px-1.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            冲突
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex gap-3 flex-wrap">
                        {course.location && course.location !== '待填写' && <span>{course.location}</span>}
                        {course.teacher && <span>{course.teacher}</span>}
                        {course.start_week && <span>第{course.start_week}-{course.end_week}周</span>}
                      </div>
                      {hasConflict && (
                        <p className="text-[11px] text-red-400 mt-0.5">
                          与「{conflictNames.slice(0, 2).join('、')}{conflictNames.length > 2 ? '等' : ''}」时间冲突，将被跳过
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3 shrink-0 pt-1">
              <Button
                onClick={handleImport}
                disabled={importing || selected.size === 0}
                className="flex-1 bg-[#165DFF] hover:bg-[#165DFF]/90"
              >
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                导入选中的 {selected.size} 门课程
              </Button>
              <Button variant="outline" onClick={() => setStep('upload')}>重新上传</Button>
            </div>
          </div>
        )}

        {/* 完成步骤 */}
        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-500" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900 text-lg">导入成功！</p>
              <p className="text-sm text-gray-500 mt-1">已成功导入 {importedCount} 门课程到课程表</p>
            </div>
            <Button onClick={handleClose} className="bg-[#165DFF] hover:bg-[#165DFF]/90 min-w-32">完成</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
