import React, { useState } from 'react';
import { MessageCircle, X, Send, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import LoginPromptModal from '@/components/LoginPromptModal';

export default function ContactAdminWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setLoginPrompt(true); return; }
    if (!subject.trim() || !content.trim()) { toast.error('请填写主题和内容'); return; }

    setSending(true);
    const { data: inserted, error } = await supabase.from('contact_messages').insert({
      user_id: user.id,
      subject: subject.trim(),
      content: content.trim(),
    }).select('id').maybeSingle();
    setSending(false);

    if (error) { toast.error('发送失败，请稍后重试'); return; }

    // 触发邮件通知给管理员
    supabase.functions.invoke('notify-admin', {
      body: {
        message_id: inserted?.id,
        sender_name: user.email || user.id,
        subject: subject.trim(),
        content: content.trim(),
      },
    }).catch(() => {/* 通知失败不影响用户体验 */});

    setSent(true);
    setSubject('');
    setContent('');
    toast.success('消息已发送，管理员将尽快回复');
    setTimeout(() => { setSent(false); setOpen(false); }, 2500);
  };

  const handleOpen = () => {
    if (!user) { setLoginPrompt(true); return; }
    setOpen(v => !v);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* 展开面板 */}
        {open && (
          <div className="w-80 bg-white rounded-2xl shadow-2xl border border-[#E5E6EB] overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
            {/* 头部 */}
            <div className="bg-[#165DFF] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">联系管理员</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容 */}
            {sent ? (
              <div className="px-4 py-8 text-center">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Send className="w-6 h-6 text-green-500" />
                </div>
                <p className="font-medium text-gray-800">消息已发送！</p>
                <p className="text-sm text-gray-500 mt-1">管理员将尽快与您联系</p>
              </div>
            ) : (
              <form onSubmit={handleSend} className="p-4 space-y-3">
                <p className="text-xs text-gray-400">遇到问题或有建议？随时联系我们！</p>
                <div>
                  <Label className="text-xs text-gray-600">主题</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="如：功能建议、操作问题…"
                    className="mt-1 h-9 text-sm"
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">详细描述</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="请详细描述您的问题或建议…"
                    className="mt-1 text-sm resize-none"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-right text-[10px] text-gray-300 mt-0.5">{content.length}/500</p>
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full h-9 bg-[#165DFF] hover:bg-[#165DFF]/90 text-sm"
                >
                  {sending ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />发送中…</>
                  ) : (
                    <><Send className="w-3.5 h-3.5 mr-1.5" />发送消息</>
                  )}
                </Button>
              </form>
            )}
          </div>
        )}

        {/* 悬浮按钮 */}
        <button
          onClick={handleOpen}
          className="w-12 h-12 rounded-full bg-[#165DFF] shadow-lg flex items-center justify-center text-white hover:bg-[#165DFF]/90 hover:scale-105 transition-all duration-200 active:scale-95"
          title="联系管理员"
          aria-label="联系管理员"
        >
          {open
            ? <ChevronDown className="w-5 h-5" />
            : <MessageCircle className="w-5 h-5" />
          }
        </button>
      </div>

      <LoginPromptModal open={loginPrompt} onClose={() => setLoginPrompt(false)} />
    </>
  );
}


