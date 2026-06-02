import React, { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Material, Course } from '@/types/types';
import { Upload, Search, Trash2, Download, FileText, File, Code2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const fileTypeIcon = (type: string) => {
  if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (['js', 'ts', 'py', 'java', 'cpp', 'c'].some(e => type.includes(e))) return <Code2 className="w-5 h-5 text-purple-500" />;
  if (type.includes('lab') || type.includes('experiment')) return <FlaskConical className="w-5 h-5 text-green-500" />;
  return <File className="w-5 h-5 text-blue-500" />;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
};

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ course_id: '', chapter: '', name: '' });

  useEffect(() => {
    if (!user) return;
    fetchMaterials();
    fetchCourses();
  }, [user, filterCourse, filterType]);

  const fetchMaterials = async () => {
    let query = supabase.from('materials').select('*, courses(name)').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (filterCourse !== 'all') query = query.eq('course_id', filterCourse);
    if (filterType !== 'all') query = query.eq('file_type', filterType);
    const { data, error } = await query;
    if (!error) setMaterials((data || []).map((m: any) => ({ ...m, course_name: m.courses?.name })));
  };

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').eq('user_id', user!.id);
    setCourses(data || []);
  };

  const detectFileType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'PDF';
    if (['doc', 'docx'].includes(ext)) return 'Word';
    if (['ppt', 'pptx'].includes(ext)) return 'PPT';
    if (['xls', 'xlsx'].includes(ext)) return 'Excel';
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) return '代码文件';
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return '视频';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return '图片';
    return '其他';
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) { toast.error('请选择文件'); return; }
    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('materials')
        .upload(fileName, file, { upsert: true });

      let fileUrl = null;
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('materials').getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('materials').insert({
        user_id: user.id,
        course_id: form.course_id || null,
        chapter: form.chapter || null,
        name: form.name || file.name,
        file_type: detectFileType(file.name),
        file_url: fileUrl,
        file_size: file.size,
      });

      if (error) { toast.error('上传失败'); return; }
      toast.success('资料上传成功');
      setShowUpload(false);
      setFile(null);
      setForm({ course_id: '', chapter: '', name: '' });
      fetchMaterials();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该资料？')) return;
    await supabase.from('materials').delete().eq('id', id);
    toast.success('删除成功');
    fetchMaterials();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setForm(f => ({ ...f, name: droppedFile.name }));
      setShowUpload(true);
    }
  }, []);

  const filtered = materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">学习资料</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="搜索资料" value={search} onChange={(e) => setSearch(e.target.value)} className="w-40 h-9 pl-9" />
            </div>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="全部课程" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部课程</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-28 h-9"><SelectValue placeholder="全部类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Word">Word</SelectItem>
                <SelectItem value="PPT">PPT</SelectItem>
                <SelectItem value="Excel">Excel</SelectItem>
                <SelectItem value="代码文件">代码文件</SelectItem>
                <SelectItem value="视频">视频</SelectItem>
                <SelectItem value="图片">图片</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowUpload(true)} className="bg-[#165DFF] hover:bg-[#165DFF]/90 h-9">
              <Upload className="w-4 h-4 mr-1" /> 上传资料
            </Button>
          </div>
        </div>

        {/* 拖拽上传区域 */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-[#165DFF] bg-[#165DFF]/5' : 'border-[#E5E6EB] hover:border-[#165DFF]/50'}`}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => setShowUpload(true)}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">拖拽文件到此处，或 <span className="text-[#165DFF]">点击上传</span></p>
          <p className="text-xs text-gray-400 mt-1">支持 PDF、Word、PPT、Excel、代码文件、视频等</p>
        </div>

        {/* 资料列表 */}
        <div className="bg-white rounded-xl border border-[#E5E6EB] overflow-hidden">
          <div className="divide-y divide-[#E5E6EB]">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                <div className="shrink-0">{fileTypeIcon(m.file_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{m.name}</div>
                  <div className="text-xs text-gray-500 flex gap-3 mt-0.5 flex-wrap">
                    <span>{m.file_type}</span>
                    <span>{formatFileSize(m.file_size)}</span>
                    {m.course_name && <span>{m.course_name}</span>}
                    {m.chapter && <span>{m.chapter}</span>}
                    <span>{new Date(m.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100">
                      <Download className="w-4 h-4 text-gray-500" />
                    </a>
                  )}
                  <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <File className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>暂无资料，上传第一份学习资料吧</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 上传弹窗 */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>上传学习资料</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label>选择文件 *</Label>
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setForm(prev => ({ ...prev, name: f.name })); }
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label>资料名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="默认使用文件名" />
            </div>
            <div>
              <Label>对应课程</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="选择课程" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>章节</Label>
              <Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="如: 第一章" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 bg-[#165DFF] hover:bg-[#165DFF]/90" disabled={uploading}>{uploading ? '上传中...' : '上传'}</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowUpload(false)}>取消</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
