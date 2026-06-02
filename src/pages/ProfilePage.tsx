import React, { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import {
  User, School, BookOpen, Mail, Shield, Save,
  Camera, Loader2, Send, BellRing, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

/** 压缩图片至 1MB 以内，转为 WebP */
async function compressImage(file: File, maxSizeKB = 1024): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const maxDim = 1080;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height / width) * maxDim); width = maxDim; }
        else { width = Math.round((width / height) * maxDim); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) {
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
            resolve(compressed);
          } else {
            quality -= 0.1;
            tryCompress();
          }
        }, 'image/webp', quality);
      };
      tryCompress();
    };
    img.src = url;
  });
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: '', school: '', major: '', grade: '', email: '' });
  const [saving, setSaving] = useState(false);

  // 头像状态
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 邮件通知设置
  const [emailNotify, setEmailNotify] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        school: profile.school || '',
        major: profile.major || '',
        grade: profile.grade || '',
        email: profile.email || '',
      });
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name || null,
      school: form.school || null,
      major: form.major || null,
      grade: form.grade || null,
      email: form.email || null,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('保存失败'); return; }
    toast.success('资料保存成功');
    refreshProfile();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) {
      toast.error('仅支持 JPEG、PNG、GIF、WEBP、AVIF 格式');
      return;
    }

    setAvatarUploading(true);
    setUploadProgress(10);

    try {
      // 超过1MB时压缩
      let uploadFile = file;
      if (file.size > 1024 * 1024) {
        toast.info('图片较大，正在自动压缩…');
        uploadFile = await compressImage(file);
        toast.info(`压缩完成，文件大小：${(uploadFile.size / 1024).toFixed(0)} KB`);
      }
      setUploadProgress(40);

      const ext = uploadFile.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'webp';
      const fileName = `${user.id}/avatar_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, uploadFile, { upsert: true, cacheControl: '3600' });

      setUploadProgress(80);

      if (uploadError) { toast.error('上传失败：' + uploadError.message); return; }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase.from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) { toast.error('保存头像失败'); return; }

      setAvatarUrl(publicUrl);
      setUploadProgress(100);
      toast.success('头像更新成功');
      refreshProfile();
    } finally {
      setAvatarUploading(false);
      setTimeout(() => setUploadProgress(0), 800);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendTestEmail = async () => {
    if (!form.email) { toast.error('请先填写并保存绑定邮箱'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { toast.error('邮箱格式不正确'); return; }

    setTestSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: form.email,
          subject: '学习助手 — 邮件通知测试',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #165DFF;">学习助手邮件通知</h2>
              <p>您好！这是一封测试邮件，说明您的邮箱已成功绑定。</p>
              <p>后续您将收到以下类型的提醒：</p>
              <ul>
                <li>作业截止提醒（提前 3 天 / 1 天 / 1 小时）</li>
                <li>考试倒计时提醒</li>
                <li>上课提醒</li>
              </ul>
              <p style="color: #888; font-size: 12px; margin-top: 24px;">学习助手平台 · 自动发送，请勿回复</p>
            </div>
          `,
        },
      });

      if (error) {
        const msg = await error?.context?.text?.();
        const parsed = msg ? JSON.parse(msg) : {};
        toast.error('发送失败：' + (parsed.error || error.message));
        return;
      }

      setTestSent(true);
      toast.success('测试邮件已发送，请查收');
      setTimeout(() => setTestSent(false), 4000);
    } finally {
      setTestSending(false);
    }
  };

  const displayName = form.full_name || profile?.email?.split('@')[0] || 'U';

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">个人中心</h1>

        {/* 基本资料卡片 */}
        <div className="bg-white rounded-xl border border-[#E5E6EB] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-[#E5E6EB] pb-3">基本资料</h2>

          {/* 头像区域 */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              <Avatar className="w-20 h-20 ring-2 ring-[#E5E6EB] ring-offset-2">
                <AvatarImage src={avatarUrl || undefined} alt="头像" className="object-cover" />
                <AvatarFallback className="bg-[#165DFF] text-white text-2xl font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* 上传遮罩 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                title="更换头像"
              >
                {avatarUploading
                  ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                  : <Camera className="w-5 h-5 text-white" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-sm text-gray-400 truncate">{profile?.email?.split('@')[0] || ''}</p>
              {avatarUploading && uploadProgress > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#165DFF] rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">上传中 {uploadProgress}%</p>
                </div>
              )}
              {!avatarUploading && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[#165DFF] mt-1.5 hover:underline"
                >
                  点击更换头像
                </button>
              )}
              <p className="text-[10px] text-gray-300 mt-0.5">支持 JPEG / PNG / GIF / WebP，超过 1MB 自动压缩</p>
            </div>
          </div>

          {/* 表单字段 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 text-sm"><User className="w-3.5 h-3.5 text-gray-400" /> 姓名</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" placeholder="真实姓名" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-sm"><School className="w-3.5 h-3.5 text-gray-400" /> 学校</Label>
              <Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} className="mt-1" placeholder="所在学校" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-sm"><BookOpen className="w-3.5 h-3.5 text-gray-400" /> 专业</Label>
              <Input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} className="mt-1" placeholder="所学专业" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-sm"><Shield className="w-3.5 h-3.5 text-gray-400" /> 年级</Label>
              <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="mt-1" placeholder="如：2023级" />
            </div>
            <div className="sm:col-span-2">
              <Label className="flex items-center gap-1.5 text-sm"><Mail className="w-3.5 h-3.5 text-gray-400" /> 通知邮箱</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
                placeholder="用于接收作业/考试/上课提醒邮件"
                type="email"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="bg-[#165DFF] hover:bg-[#165DFF]/90">
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中…' : '保存修改'}
          </Button>
        </div>

        {/* 邮件通知设置卡片 */}
        <div className="bg-white rounded-xl border border-[#E5E6EB] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-[#E5E6EB] pb-3 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#165DFF]" /> 邮件通知设置
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[#E5E6EB]/60">
              <div>
                <p className="text-sm font-medium text-gray-800">作业截止提醒</p>
                <p className="text-xs text-gray-400">提前 3 天 / 1 天 / 1 小时发送邮件</p>
              </div>
              <Switch checked={emailNotify} onCheckedChange={setEmailNotify} />
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#E5E6EB]/60">
              <div>
                <p className="text-sm font-medium text-gray-800">考试倒计时提醒</p>
                <p className="text-xs text-gray-400">考试前 7 天 / 1 天发送提醒</p>
              </div>
              <Switch checked={emailNotify} onCheckedChange={setEmailNotify} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">上课提醒</p>
                <p className="text-xs text-gray-400">上课前 15 分钟发送邮件</p>
              </div>
              <Switch checked={emailNotify} onCheckedChange={setEmailNotify} />
            </div>
          </div>

          {/* 测试邮件 */}
          <div className="pt-2 border-t border-[#E5E6EB]">
            <p className="text-xs text-gray-400 mb-3">
              发送测试邮件至：<span className="font-medium text-gray-600">{form.email || '（未设置邮箱）'}</span>
            </p>
            <Button
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={testSending || !form.email}
              className="h-9"
            >
              {testSending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />发送中…</>
              ) : testSent ? (
                <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />已发送！</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />发送测试邮件</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
