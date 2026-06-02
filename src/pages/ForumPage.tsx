import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen, GraduationCap, Briefcase, BookMarked,
  Plus, ChevronRight, MessageSquare, Eye, Clock,
  ArrowLeft, Send, Loader2, Pin, Search, User,
  Flame, TrendingUp, Bell, X, MessageCircle,
  ChevronLeft, VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import LoginPromptModal from '@/components/LoginPromptModal';
import { toast } from 'sonner';
import { useKeywordFilter } from '@/hooks/useKeywordFilter';

// ── 类型 ──────────────────────────────────────────
type Category = string;

interface ForumCategory {
  id: string; key: string; label: string; icon_name: string;
  color: string; description: string | null; sort_order: number; is_active: boolean;
}

interface ForumPost {
  id: string;
  category: Category;
  title: string;
  content: string;
  author_id: string;
  views: number;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  reply_count?: number;
  author_name?: string;
}

interface ForumReply {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
  author_name?: string;
}

interface DM {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ── 图标映射 ──────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen, GraduationCap, Briefcase, BookMarked,
  MessageSquare, Flame, TrendingUp, Bell,
};

function getCatIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || BookOpen;
}

// ── 颜色工具 ──────────────────────────────────────
function colorToBg(color: string) {
  return color.replace('text-', 'bg-').replace('-600', '-100').replace('-500', '-50').replace('-400', '-50');
}

// ── 头像 ─────────────────────────────────────────
function UserAvatar({ name, size = 8 }: { name: string; size?: number }) {
  const colors = ['bg-[#165DFF]', 'bg-orange-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500', 'bg-teal-500'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <Avatar className={`w-${size} h-${size} shrink-0`}>
      <AvatarFallback className={`${color} text-white text-xs font-medium`}>
        {name?.[0]?.toUpperCase() || '?'}
      </AvatarFallback>
    </Avatar>
  );
}

// ── 私信收件箱 ───────────────────────────────────
interface DMConv {
  peerId: string;
  peerName: string;
  lastMsg: string;
  lastAt: string;
  unread: number;
}

function DMInbox({ onSelectPeer, onClose }: { onSelectPeer: (id: string, name: string) => void; onClose: () => void }) {
  const { user } = useAuth();
  const [convs, setConvs] = useState<DMConv[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('forum_direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!data) { setLoading(false); return; }
      // 按对话分组
      const map = new Map<string, DMConv>();
      for (const m of data as DM[]) {
        const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!map.has(peerId)) {
          map.set(peerId, { peerId, peerName: peerId, lastMsg: m.content, lastAt: m.created_at, unread: 0 });
        }
        if (m.receiver_id === user.id && !m.is_read) {
          map.get(peerId)!.unread += 1;
        }
      }
      // 拉取对话方名字
      const ids = [...map.keys()];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id,full_name,email')
          .in('id', ids);
        (profiles || []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
          if (map.has(p.id)) {
            map.get(p.id)!.peerName = p.full_name || p.email?.split('@')[0] || '未知用户';
          }
        });
      }
      setConvs([...map.values()]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E6EB] bg-white shrink-0">
        <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#165DFF]" />私信收件箱
        </span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#F5F7FA]">
        {loading && (
          <div className="space-y-2 p-3">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-200 animate-pulse" />)}
          </div>
        )}
        {!loading && convs.length === 0 && (
          <div className="text-center pt-12 text-sm text-gray-400">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            暂无私信记录
          </div>
        )}
        {!loading && convs.map(c => (
          <button key={c.peerId} onClick={() => onSelectPeer(c.peerId, c.peerName)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white border-b border-[#E5E6EB] transition-colors text-left">
            <UserAvatar name={c.peerName} size={9} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{c.peerName}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{c.lastMsg}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <p className="text-[10px] text-gray-400">
                {new Date(c.lastAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              </p>
              {c.unread > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {c.unread}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 私信抽屉 ─────────────────────────────────────
function DMDrawer({
  peerId, peerName, onClose, onBack,
}: { peerId: string; peerName: string; onClose: () => void; onBack?: () => void }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<DM[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('forum_direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    setMsgs((data || []) as DM[]);
    // 标为已读
    if (user) {
      await supabase.from('forum_direct_messages')
        .update({ is_read: true })
        .eq('sender_id', peerId).eq('receiver_id', user.id).eq('is_read', false);
    }
  }, [user, peerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`forum-dm-${user.id}-${peerId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'forum_direct_messages',
      }, (payload) => {
        const m = payload.new as DM;
        if ((m.sender_id === peerId && m.receiver_id === user.id) ||
            (m.sender_id === user.id && m.receiver_id === peerId)) {
          setMsgs(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, peerId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('forum_direct_messages').insert({
      sender_id: user.id, receiver_id: peerId, content: text.trim(),
    });
    setSending(false);
    if (error) { toast.error('发送失败'); return; }
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E6EB] bg-white shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 mr-1">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <UserAvatar name={peerName} size={7} />
          <span className="text-sm font-semibold text-gray-800">{peerName}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F5F7FA]">
        {msgs.length === 0 && (
          <div className="text-center pt-8 text-sm text-gray-400">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            发送第一条消息开始对话
          </div>
        )}
        {msgs.map(m => {
          const isMine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                isMine
                  ? 'bg-[#165DFF] text-white rounded-br-sm'
                  : 'bg-white text-gray-800 border border-[#E5E6EB] rounded-bl-sm'
              }`}>
                <p>{m.content}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSend} className="px-3 py-3 border-t border-[#E5E6EB] bg-white flex gap-2 shrink-0">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`私信 ${peerName}…`}
          className="flex-1 h-9 text-sm"
          maxLength={2000}
        />
        <Button type="submit" disabled={sending || !text.trim()}
          className="h-9 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white px-3">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </form>
    </div>
  );
}

// ── 帖子列表（贴吧风格）────────────────────────────
function PostList({
  cat, catLabel, onSelect, onNew,
}: { cat: Category; catLabel: string; onSelect: (p: ForumPost) => void; onNew: () => void }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [loginPrompt, setLoginPrompt] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('forum_posts')
      .select('*')
      .eq('category', cat)
      .eq('is_deleted', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    const { data: postsData } = await q;
    const ps = (postsData || []) as ForumPost[];
    if (ps.length) {
      const ids = [...new Set(ps.map(p => p.author_id))];
      const { data: profiles } = await supabase.from('public_profiles').select('id,full_name').in('id', ids);
      const nm = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || '用户']));
      const replyCounts = await supabase.from('forum_replies')
        .select('post_id').in('post_id', ps.map(p => p.id)).eq('is_deleted', false);
      const rcMap: Record<string, number> = {};
      (replyCounts.data || []).forEach((r: { post_id: string }) => { rcMap[r.post_id] = (rcMap[r.post_id] || 0) + 1; });
      ps.forEach(p => { p.author_name = nm[p.author_id] || '用户'; p.reply_count = rcMap[p.id] || 0; });
    }
    setPosts(ps);
    setLoading(false);
  }, [cat, search]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleNew = () => {
    if (!user) { setLoginPrompt(true); return; }
    onNew();
  };

  return (
    <div>
      {/* 板块头部 — 贴吧风格 */}
      <div className="bg-[#165DFF] rounded-t-xl px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{catLabel}</h2>
          <p className="text-white/70 text-xs mt-0.5">{posts.length} 个帖子</p>
        </div>
        <Button onClick={handleNew} className="h-8 bg-white text-[#165DFF] hover:bg-white/90 text-xs gap-1 font-semibold">
          <Plus className="w-3.5 h-3.5" />发帖
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white border-x border-[#E5E6EB] px-4 py-2.5 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索帖子标题…" className="pl-8 h-8 text-sm border-gray-200" />
        </div>
      </div>

      {/* 帖子列表 */}
      <div className="bg-white border border-[#E5E6EB] rounded-b-xl divide-y divide-[#F0F2F7]">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">暂无帖子，快来发第一帖！</p>
          </div>
        ) : posts.map(post => (
          <button key={post.id} onClick={() => onSelect(post)}
            className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-[#F5F7FA] transition-colors text-left">
            {/* 楼主头像 */}
            <UserAvatar name={post.author_name || '?'} size={9} />
            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {post.is_pinned && (
                  <Badge className="bg-[#FF7D00]/10 text-[#FF7D00] border-0 text-[10px] gap-0.5 py-0 px-1.5 h-4">
                    <Pin className="w-2.5 h-2.5" />置顶
                  </Badge>
                )}
                <span className="text-sm font-semibold text-gray-900 line-clamp-1 text-balance">{post.title}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-1 mb-2 text-pretty">
                {post.content.slice(0, 80)}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author_name}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.reply_count || 0} 回复</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.views}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(post.created_at).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
          </button>
        ))}
      </div>
      <LoginPromptModal open={loginPrompt} onClose={() => setLoginPrompt(false)} action="发帖" />
    </div>
  );
}

// ── 帖子详情（贴吧楼层风格）─────────────────────────
function PostDetail({ post, onBack, onStartDM }: {
  post: ForumPost; onBack: () => void;
  onStartDM: (peerId: string, peerName: string) => void;
}) {
  const { user } = useAuth();
  const { checkContent } = useKeywordFilter();
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [authorName, setAuthorName] = useState(post.author_name || '用户');
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    supabase.from('forum_posts').update({ views: (post.views || 0) + 1 }).eq('id', post.id).then(() => {});

    const loadReplies = async () => {
      const { data } = await supabase.from('forum_replies')
        .select('*').eq('post_id', post.id).eq('is_deleted', false)
        .order('created_at', { ascending: true });
      const repliesData = (data || []) as ForumReply[];
      if (repliesData.length) {
        const ids = [...new Set(repliesData.map(r => r.author_id))];
        const { data: profiles } = await supabase.from('public_profiles').select('id,full_name').in('id', ids);
        const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || '用户']));
        repliesData.forEach(r => { r.author_name = nameMap[r.author_id] || '用户'; });
      }
      setReplies(repliesData);
      setLoading(false);
    };
    loadReplies();

    // 检查当前用户是否被封禁
    if (user) {
      supabase.from('profiles').select('banned_until').eq('id', user.id).maybeSingle().then(({ data }) => {
        if (data?.banned_until) setIsBanned(new Date(data.banned_until) > new Date());
      });
    }

    const channel = supabase.channel(`forum-post-${post.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_replies', filter: `post_id=eq.${post.id}` },
        async (payload) => {
          const r = payload.new as ForumReply;
          if (r.is_deleted) return;
          const { data: p } = await supabase.from('public_profiles').select('full_name').eq('id', r.author_id).maybeSingle();
          r.author_name = p?.full_name || '用户';
          setReplies(prev => prev.some(x => x.id === r.id) ? prev : [...prev, r]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id, post.views, user]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setLoginPrompt(true); return; }
    if (isBanned) { toast.error('你的账号已被封禁，暂时无法回复'); return; }
    if (!replyText.trim()) { toast.error('回复内容不能为空'); return; }
    // 关键词检测
    const hits = await checkContent(replyText);
    if (hits.length > 0) { toast.error(`回复包含违禁词：${hits.slice(0, 3).join('、')}，请修改后重新提交`); return; }
    setSubmitting(true);
    const { error } = await supabase.from('forum_replies').insert({
      post_id: post.id, author_id: user.id, content: replyText.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error('回复失败'); return; }
    setReplyText('');
    toast.success('回复成功');
  };

  const floorLabel = (idx: number) => idx === 0 ? '楼主' : `${idx + 1}楼`;

  return (
    <div>
      {/* 返回按钮 */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#165DFF] mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" />返回列表
      </button>

      {/* 帖子标题栏 — 贴吧风格 */}
      <div className="bg-white rounded-xl border border-[#E5E6EB] overflow-hidden mb-3">
        <div className="bg-[#165DFF]/5 border-b border-[#E5E6EB] px-5 py-3 flex items-center gap-2">
          {post.is_pinned && (
            <Badge className="bg-[#FF7D00]/10 text-[#FF7D00] border-0 text-xs gap-1">
              <Pin className="w-3 h-3" />置顶
            </Badge>
          )}
          <h1 className="text-base font-bold text-gray-900 flex-1 text-balance">{post.title}</h1>
        </div>

        {/* 楼主（1楼） */}
        <div className="px-5 py-4">
          <div className="flex gap-3">
            {/* 左侧：头像 + 用户名 */}
            <div className="flex flex-col items-center w-14 shrink-0">
              <UserAvatar name={authorName} size={10} />
              <span className="text-[11px] text-gray-600 font-medium mt-1.5 text-center leading-tight">{authorName}</span>
              <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-[10px] mt-1 py-0 px-1.5">楼主</Badge>
            </div>
            {/* 右侧：内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleString('zh-CN')}</span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Eye className="w-3 h-3" />{post.views}
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap text-pretty">
                {post.content}
              </div>
              {/* 帖子图片 */}
              {Array.isArray((post as ForumPost & { image_urls?: string[] }).image_urls) &&
               ((post as ForumPost & { image_urls?: string[] }).image_urls || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {((post as ForumPost & { image_urls?: string[] }).image_urls || []).map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="block w-28 h-28 rounded-lg overflow-hidden border border-[#E5E6EB] hover:opacity-90 transition-opacity">
                      <img src={url} alt={`图片${i+1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {/* 私信按钮 */}
              {user && post.author_id !== user.id && (
                <button
                  onClick={() => onStartDM(post.author_id, authorName)}
                  className="mt-3 flex items-center gap-1 text-xs text-[#165DFF] hover:text-[#165DFF]/80 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />私信楼主
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 回复列表 */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : (
        <div className="space-y-2 mb-4">
          {replies.map((r, idx) => (
            <div key={r.id} className="bg-white rounded-xl border border-[#E5E6EB] px-5 py-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center w-14 shrink-0">
                  <UserAvatar name={r.author_name || '?'} size={9} />
                  <span className="text-[11px] text-gray-600 font-medium mt-1.5 text-center leading-tight">{r.author_name}</span>
                  <Badge className="bg-gray-100 text-gray-500 border-0 text-[10px] mt-1 py-0 px-1.5">{floorLabel(idx + 1)}</Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap text-pretty">{r.content}</p>
                  {user && r.author_id !== user.id && (
                    <button
                      onClick={() => onStartDM(r.author_id, r.author_name || '用户')}
                      className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-[#165DFF] transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />私信
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 回复框 */}
      <div className="bg-white rounded-xl border border-[#E5E6EB] p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">发表回复</p>
        {isBanned && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3 text-sm text-red-600">
            <VolumeX className="w-4 h-4 shrink-0" />你的账号已被封禁，暂时无法参与讨论
          </div>
        )}
        {user ? (
          <form onSubmit={handleReply} className="flex gap-3">
            <UserAvatar name={(user as { email?: string })?.email || '我'} size={8} />
            <div className="flex-1">
              <Textarea
                value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder={isBanned ? '账号已封禁' : '写下你的回复…'}
                rows={3} maxLength={2000} disabled={isBanned}
                className="resize-none text-sm mb-2"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{replyText.length}/2000</span>
                <Button type="submit" disabled={submitting || isBanned}
                  className="h-8 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white text-sm gap-1.5">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  回复
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-2">登录后才能参与讨论</p>
            <Button onClick={() => setLoginPrompt(true)} className="bg-[#165DFF] hover:bg-[#165DFF]/90 text-white h-9">
              立即登录
            </Button>
          </div>
        )}
      </div>
      <LoginPromptModal open={loginPrompt} onClose={() => setLoginPrompt(false)} action="回复帖子" />
    </div>
  );
}

// ── 发帖弹窗 ──────────────────────────────────────
function NewPostDialog({
  open, onClose, cat, onSuccess,
}: { open: boolean; onClose: () => void; cat: Category; onSuccess: () => void }) {
  const { user } = useAuth();
  const { checkContent } = useKeywordFilter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from('profiles').select('banned_until').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.banned_until) setIsBanned(new Date(data.banned_until) > new Date());
    });
  }, [open, user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    if (imageUrls.length + files.length > 4) { toast.error('最多上传4张图片'); return; }
    setUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} 超过5MB限制`); continue; }
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `posts/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('forum-images').upload(path, file, { contentType: file.type });
      if (error) { toast.error('图片上传失败'); continue; }
      const { data: urlData } = supabase.storage.from('forum-images').getPublicUrl(path);
      setImageUrls(prev => [...prev, urlData.publicUrl]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (isBanned) { toast.error('你的账号已被封禁，暂时无法发帖'); return; }
    if (!title.trim()) { toast.error('请填写帖子标题'); return; }
    if (!content.trim()) { toast.error('请填写帖子内容'); return; }
    if (title.length < 5) { toast.error('标题至少5个字符'); return; }
    // 关键词检测（标题 + 内容）
    const hits = await checkContent(title + ' ' + content);
    if (hits.length > 0) { toast.error(`内容包含违禁词：${hits.slice(0, 3).join('、')}，请修改后重新提交`); return; }
    setSubmitting(true);
    const { error } = await supabase.from('forum_posts').insert({
      category: cat, title: title.trim(), content: content.trim(),
      author_id: user.id, image_urls: imageUrls,
    });
    setSubmitting(false);
    if (error) { toast.error('发帖失败：' + error.message); return; }
    toast.success('发帖成功！');
    setTitle(''); setContent(''); setImageUrls([]);
    onClose(); onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>发表新帖</DialogTitle>
        </DialogHeader>
        {isBanned ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            <VolumeX className="w-5 h-5 shrink-0" />
            <span className="text-sm">你的账号已被封禁，无法发帖。如有异议请联系管理员。</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-normal text-gray-700">标题</label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="请输入帖子标题（5-100字）" maxLength={100} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-normal text-gray-700">内容</label>
              <Textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="分享你的经验、问题或资料…" rows={6} maxLength={5000}
                className="resize-none" />
              <p className="text-right text-xs text-gray-400">{content.length}/5000</p>
            </div>
            {/* 图片上传区 */}
            <div className="space-y-2">
              <label className="text-sm font-normal text-gray-700">图片（选填，最多4张）</label>
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((url, i) => (
                  <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#E5E6EB] group">
                    <img src={url} alt={`图片${i+1}`} className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {imageUrls.length < 4 && (
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-[#E5E6EB] flex flex-col items-center justify-center text-gray-400 hover:border-[#165DFF] hover:text-[#165DFF] transition-colors">
                    {uploading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><Plus className="w-5 h-5 mb-1" /><span className="text-[10px]">添加图片</span></>
                    }
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={handleImageUpload} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={submitting || uploading}
                className="bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                发布帖子
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── 主页面 ────────────────────────────────────────
export default function ForumPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const cat = params.get('cat') || null;
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  // 私信抽屉：null=关闭, {id:'',name:''}=收件箱, {id:xxx}=对话
  const [dmPeer, setDmPeer] = useState<{ id: string; name: string } | null>(null);
  // 未读私信数
  const { user } = useAuth();
  const [unreadDM, setUnreadDM] = useState(0);

  useEffect(() => {
    supabase.from('forum_categories')
      .select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data || []) as ForumCategory[]));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('forum_direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id).eq('is_read', false)
      .then(({ count }) => setUnreadDM(count || 0));
  }, [user]);

  const handleCatSelect = (key: string) => {
    setParams({ cat: key });
    setSelectedPost(null);
  };

  const catLabel = categories.find(c => c.key === cat)?.label || cat || '';

  return (
    <div className="min-h-screen bg-[#F0F2F7]">
      <div className="max-w-[1100px] mx-auto px-4 py-6">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#165DFF]" />校园论坛
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">分享知识，共同成长</p>
            </div>
          </div>
          {/* 私信入口 */}
          {user && (
            <button
              onClick={() => setDmPeer(dmPeer ? null : { id: '', name: '' })}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#E5E6EB] text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />私信
              {unreadDM > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {unreadDM}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* 左侧版块导航 — 贴吧侧边栏风格 */}
          <div className="lg:col-span-1 space-y-3">
            <div className="bg-white rounded-xl border border-[#E5E6EB] overflow-hidden">
              <div className="px-4 py-3 bg-[#165DFF] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-white" />
                <p className="font-semibold text-white text-sm">版块导航</p>
              </div>
              <div>
                <button
                  onClick={() => { setParams({}); setSelectedPost(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 border-b border-[#F0F2F7] ${!cat ? 'bg-[#165DFF]/5 border-l-2 border-l-[#165DFF]' : ''}`}
                >
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <span className={`text-sm ${!cat ? 'text-[#165DFF] font-semibold' : 'text-gray-700'}`}>全部版块</span>
                </button>
                {categories.map(({ key, label, icon_name, color }) => {
                  const Icon = getCatIcon(icon_name);
                  const bg = colorToBg(color);
                  return (
                    <button key={key} onClick={() => handleCatSelect(key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 border-b border-[#F0F2F7] last:border-b-0 ${
                        cat === key ? 'bg-[#165DFF]/5 border-l-2 border-l-[#165DFF]' : ''
                      }`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg} shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                      <span className={`text-sm ${cat === key ? 'text-[#165DFF] font-semibold' : 'text-gray-700'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧内容区 */}
          <div className="lg:col-span-3">
            {!cat ? (
              // 首页：版块卡片（贴吧广场风格）
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map(({ key, label, icon_name, color, description }) => {
                  const Icon = getCatIcon(icon_name);
                  const bg = colorToBg(color);
                  return (
                    <button key={key} onClick={() => handleCatSelect(key)}
                      className="bg-white rounded-xl border border-[#E5E6EB] p-4 text-left hover:shadow-md hover:border-[#165DFF]/30 transition-all group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                          <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 group-hover:text-[#165DFF] transition-colors text-sm">{label}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2 text-pretty">{description}</p>
                      <div className="flex items-center gap-1 mt-3 text-xs text-[#165DFF]">
                        进入版块<ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : selectedPost ? (
              <PostDetail
                post={selectedPost}
                onBack={() => setSelectedPost(null)}
                onStartDM={(id, name) => setDmPeer({ id, name })}
              />
            ) : (
              <>
                <PostList key={`${cat}-${refreshKey}`} cat={cat} catLabel={catLabel}
                  onSelect={setSelectedPost} onNew={() => setShowNew(true)} />
                <NewPostDialog open={showNew} onClose={() => setShowNew(false)} cat={cat}
                  onSuccess={() => setRefreshKey(k => k + 1)} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* 私信侧边抽屉 */}
      {dmPeer && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-[#E5E6EB] z-50 flex flex-col">
          {dmPeer.id ? (
            <DMDrawer
              peerId={dmPeer.id}
              peerName={dmPeer.name}
              onClose={() => setDmPeer(null)}
              onBack={() => setDmPeer({ id: '', name: '' })}
            />
          ) : (
            <DMInbox
              onSelectPeer={(id, name) => setDmPeer({ id, name })}
              onClose={() => setDmPeer(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
