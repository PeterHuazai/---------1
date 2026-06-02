import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PostComment } from '@/types/types';
import UserProfileModal from '@/components/UserProfileModal';

interface CommentsSectionProps {
  postType: 'secondhand' | 'lostfound';
  postId: string;
  onRequireLogin?: (action: string) => void;
}

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.slice(0, 2);
  if (email) return email[0].toUpperCase();
  return '?';
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default function CommentsSection({ postType, postId, onRequireLogin }: CommentsSectionProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, { name: string | null; avatar: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 加载评论 + 对应用户资料
  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_type', postType)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    const rows: PostComment[] = data || [];
    setComments(rows);
    setLoading(false);

    // 批量获取用户资料（公开字段，anon 和 authenticated 均可读）
    const uids = [...new Set(rows.map(r => r.user_id))];
    if (uids.length) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', uids);
      const map: Record<string, { name: string | null; avatar: string | null }> = {};
      ((profiles || []) as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[]).forEach(p => {
        map[p.id] = { name: p.full_name || p.email?.split('@')[0] || '同学', avatar: p.avatar_url };
      });
      setProfileMap(map);
    }
  }, [postType, postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Realtime 订阅
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${postType}:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_type=eq.${postType}`,
        },
        (payload) => {
          const newComment = payload.new as PostComment;
          if (newComment.post_id !== postId) return;
          setComments(prev => [...prev, newComment]);
          // 延迟滚动到底部
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_comments',
        },
        (payload) => {
          setComments(prev => prev.filter(c => c.id !== (payload.old as PostComment).id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postType, postId]);

  const handleSubmit = async () => {
    if (!user) { onRequireLogin?.('发表评论'); return; }
    if (!content.trim()) return;
    if (content.trim().length > 500) { toast.error('评论不能超过500字'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('post_comments').insert({
      post_type: postType,
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
    });
    setSubmitting(false);

    if (error) { toast.error('发表失败，请重试'); return; }
    setContent('');
    // 将当前用户信息加入 profileMap（如果还没有）
    if (!profileMap[user.id]) {
      setProfileMap(prev => ({
        ...prev,
        [user.id]: {
          name: profile?.full_name || profile?.email?.split('@')[0] || null,
          avatar: profile?.avatar_url || null,
        },
      }));
    }
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (error) { toast.error('删除失败'); return; }
    toast.success('已删除');
  };

  return (
    <div className="mt-6 border-t border-[#E5E6EB] pt-6">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4.5 h-4.5 text-[#165DFF]" style={{ width: 18, height: 18 }} />
        <h3 className="text-base font-semibold text-gray-800">评论区</h3>
        {comments.length > 0 && (
          <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs">{comments.length}条</Badge>
        )}
        <span className="text-xs text-gray-400 ml-1">（实时更新）</span>
      </div>

      {/* 评论列表 */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-4">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">暂无评论，来抢沙发吧！</p>
          </div>
        )}
        {comments.map(comment => {
          const p = profileMap[comment.user_id];
          const displayName = p?.name || '匿名用户';
          const isOwn = user?.id === comment.user_id;
          return (
            <div key={comment.id} className="flex gap-3 group">
              <button
                onClick={() => setSelectedUserId(comment.user_id)}
                className="shrink-0 mt-0.5 hover:opacity-80 transition-opacity"
                title={`查看 ${displayName} 的资料`}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={p?.avatar ?? undefined} />
                  <AvatarFallback className="text-xs bg-[#165DFF]/10 text-[#165DFF] font-medium">
                    {getInitials(p?.name)}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedUserId(comment.user_id)}
                    className="text-sm font-medium text-gray-800 hover:text-[#165DFF] transition-colors"
                  >
                    {displayName}
                  </button>
                  {isOwn && <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-[10px] px-1.5 h-4">我</Badge>}
                  <span className="text-[11px] text-gray-400">{timeAgo(comment.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed break-words">{comment.content}</p>
              </div>
              {isOwn && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-400 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="flex gap-2 items-end">
        {user ? (
          <Avatar className="w-8 h-8 shrink-0 mb-1">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-[#165DFF]/10 text-[#165DFF] font-medium">
              {getInitials(profile?.full_name, profile?.email)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-8 h-8 shrink-0 mb-1 rounded-full bg-gray-100 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
          </div>
        )}
        <div className="flex-1 relative">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={user ? '发表你的看法…（Enter发送，Shift+Enter换行）' : '登录后参与评论'}
            rows={2}
            className="resize-none pr-2 text-sm min-h-[60px]"
            readOnly={!user}
            onClick={() => { if (!user) onRequireLogin?.('发表评论'); }}
          />
          <span className={`absolute bottom-2 right-2 text-[10px] ${content.length > 450 ? 'text-red-400' : 'text-gray-300'}`}>
            {content.length}/500
          </span>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="h-10 px-4 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-xl shrink-0 mb-1 gap-1.5"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          发送
        </Button>
      </div>

      {/* 用户资料弹窗 */}
      <UserProfileModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onRequireLogin={() => { setSelectedUserId(null); onRequireLogin?.('查看用户资料'); }}
      />
    </div>
  );
}
