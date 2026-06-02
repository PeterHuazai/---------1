import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Friendship, PublicProfile } from '@/types/types';
import {
  Users, Search, UserPlus, UserCheck, UserX, Clock,
  ChevronRight, School, BookOpen, GraduationCap, X, Check,
  MessageCircle, Send, Loader2, ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// ── 私聊数据类型 ───────────────────────────────────────────────
interface PrivateMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  userId: string;
  profile: PublicProfile | null;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

function timeStr(dateStr: string) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

// ── 用户头像工具 ─────────────────────────────────────────────
function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.slice(0, 2);
  if (email) return email[0].toUpperCase();
  return '?';
}

// ── 用户卡片 ─────────────────────────────────────────────────
interface UserCardProps {
  profile: PublicProfile;
  relation?: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  friendshipId?: string;
  onSendRequest: (uid: string) => void;
  onAccept: (friendshipId: string) => void;
  onDecline: (friendshipId: string) => void;
  onRemove: (friendshipId: string) => void;
  onChat?: (uid: string) => void;
}

function UserCard({ profile, relation = 'none', friendshipId, onSendRequest, onAccept, onDecline, onRemove, onChat }: UserCardProps) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E6EB] bg-white hover:shadow-sm transition-all">
      <Avatar className="w-11 h-11 shrink-0">
        <AvatarImage src={profile.avatar_url ?? undefined} />
        <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] font-semibold text-sm">
          {getInitials(profile.full_name, profile.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">
          {profile.full_name || profile.email?.split('@')[0] || '未知用户'}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {profile.school && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <School className="w-3 h-3" />{profile.school}
            </span>
          )}
          {profile.major && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <BookOpen className="w-3 h-3" />{profile.major}
            </span>
          )}
          {profile.grade && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <GraduationCap className="w-3 h-3" />{profile.grade}
            </span>
          )}
          {typeof profile.friend_count === 'number' && (
            <span className="flex items-center gap-1 text-[11px] text-[#165DFF]/70">
              <Users className="w-3 h-3" />{profile.friend_count} 好友
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {relation === 'none' && (
          <Button size="sm" onClick={() => onSendRequest(profile.id)}
            className="h-8 text-xs bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-lg gap-1 px-3">
            <UserPlus className="w-3.5 h-3.5" />加好友
          </Button>
        )}
        {relation === 'pending_sent' && (
          <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs gap-1 font-normal">
            <Clock className="w-3 h-3" />已发送
          </Badge>
        )}
        {relation === 'pending_received' && friendshipId && (
          <>
            <Button size="sm" onClick={() => onAccept(friendshipId)}
              className="h-8 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg gap-1 px-3">
              <Check className="w-3.5 h-3.5" />接受
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDecline(friendshipId)}
              className="h-8 text-xs rounded-lg gap-1 px-3 border-[#E5E6EB]">
              <X className="w-3.5 h-3.5" />拒绝
            </Button>
          </>
        )}
        {relation === 'accepted' && friendshipId && (
          <>
            {onChat && (
              <Button size="sm" onClick={() => onChat(profile.id)}
                className="h-8 text-xs rounded-lg gap-1 px-3 border-0"
                style={{ background: 'rgba(22,93,255,0.08)', color: '#165DFF' }}>
                <MessageCircle className="w-3.5 h-3.5" />私聊
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onRemove(friendshipId)}
              className="h-8 text-xs rounded-lg gap-1 px-3 text-red-500 border-red-200 hover:bg-red-50">
              <UserX className="w-3.5 h-3.5" />删除
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 内嵌私聊面板 ──────────────────────────────────────────────
interface ChatPanelProps {
  user: { id: string } | null;
  profile: { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null;
  initialPeerId?: string | null;
  friends: (Friendship & { profile: PublicProfile })[];
  onClose: () => void;
}

function ChatPanel({ user, profile, initialPeerId, friends, onClose }: ChatPanelProps) {
  const [activePeerId, setActivePeerId] = useState<string | null>(initialPeerId ?? null);
  const [activePeer, setActivePeer] = useState<PublicProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileShowConvs, setMobileShowConvs] = useState(!initialPeerId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConvsLoading(true);
    const { data } = await supabase
      .from('private_messages').select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const msgs: PrivateMessage[] = data || [];
    const seen = new Set<string>();
    const convMap: Record<string, { lastMessage: string; lastTime: string; unread: number }> = {};
    msgs.forEach(m => {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!seen.has(peerId)) { seen.add(peerId); convMap[peerId] = { lastMessage: m.content, lastTime: m.created_at, unread: 0 }; }
      if (!m.is_read && m.receiver_id === user.id) convMap[peerId].unread = (convMap[peerId]?.unread || 0) + 1;
    });

    const allPeerIds = [...new Set([...seen, ...friends.map(f => f.profile.id)])];
    const profileMap: Record<string, PublicProfile> = {};
    friends.forEach(f => { profileMap[f.profile.id] = f.profile; });
    const missingIds = allPeerIds.filter(id => !profileMap[id]);
    if (missingIds.length) {
      const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', missingIds);
      (profiles || []).forEach((p: PublicProfile) => { profileMap[p.id] = p; });
    }

    setConversations(allPeerIds.map(pid => ({
      userId: pid, profile: profileMap[pid] || null,
      lastMessage: convMap[pid]?.lastMessage ?? '',
      lastTime: convMap[pid]?.lastTime ?? '',
      unread: convMap[pid]?.unread ?? 0,
    })));
    setConvsLoading(false);
  }, [user, friends]);

  const loadMessages = useCallback(async (peerId: string) => {
    if (!user) return;
    setMsgsLoading(true);
    const { data } = await supabase.from('private_messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    setMessages((data as PrivateMessage[]) || []);
    setMsgsLoading(false);
    await supabase.from('private_messages').update({ is_read: true })
      .eq('sender_id', peerId).eq('receiver_id', user.id).eq('is_read', false);
  }, [user]);

  const openConversation = useCallback(async (peerId: string) => {
    setActivePeerId(peerId);
    setMobileShowConvs(false);
    const { data } = await supabase.from('public_profiles').select('*').eq('id', peerId).maybeSingle();
    setActivePeer(data);
    await loadMessages(peerId);
  }, [loadMessages]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (initialPeerId && user) openConversation(initialPeerId); }, [initialPeerId, user, openConversation]);
  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80); }, [messages]);

  useEffect(() => {
    if (!user || !activePeerId) return;
    const channel = supabase.channel(`chat:${[user.id, activePeerId].sort().join(':')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, (payload) => {
        const msg = payload.new as PrivateMessage;
        const relevant = (msg.sender_id === user.id && msg.receiver_id === activePeerId) ||
                         (msg.sender_id === activePeerId && msg.receiver_id === user.id);
        if (!relevant) return;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.receiver_id === user.id) supabase.from('private_messages').update({ is_read: true }).eq('id', msg.id);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, activePeerId]);

  const handleSend = async () => {
    if (!user || !activePeerId || !content.trim()) return;
    setSending(true);
    const { error } = await supabase.from('private_messages').insert({ sender_id: user.id, receiver_id: activePeerId, content: content.trim() });
    setSending(false);
    if (error) { toast.error('发送失败'); return; }
    setContent('');
    loadConversations();
  };

  const displayName = activePeer?.full_name || activePeer?.email?.split('@')[0] || '对方';
  const myName = profile?.full_name || profile?.email?.split('@')[0] || '我';

  return (
    <div className="flex h-full">
      {/* 对话列表 */}
      <aside className={`${mobileShowConvs ? 'flex' : 'hidden'} md:flex w-full md:w-60 border-r border-[#E5E6EB] flex-col shrink-0`}>
        <div className="h-12 px-3 flex items-center justify-between border-b border-[#E5E6EB] shrink-0">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-[#165DFF]" />
            <span className="font-semibold text-gray-800 text-sm">私聊</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convsLoading && <div className="flex justify-center pt-6"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>}
          {!convsLoading && conversations.length === 0 && (
            <div className="text-center py-10 px-3">
              <MessageCircle className="w-8 h-8 mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">点击好友右侧「私聊」开始聊天</p>
            </div>
          )}
          {conversations.map(conv => {
            const name = conv.profile?.full_name || conv.profile?.email?.split('@')[0] || '同学';
            const isActive = conv.userId === activePeerId;
            return (
              <button key={conv.userId} onClick={() => openConversation(conv.userId)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors ${isActive ? 'bg-[#165DFF]/5 border-r-2 border-[#165DFF]' : ''}`}>
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={conv.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-xs font-medium">
                    {getInitials(conv.profile?.full_name, conv.profile?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-800 truncate">{name}</span>
                    {conv.lastTime && <span className="text-[10px] text-gray-400 shrink-0 ml-1">{timeStr(conv.lastTime)}</span>}
                  </div>
                  {conv.lastMessage && <p className="text-[11px] text-gray-400 truncate">{conv.lastMessage}</p>}
                </div>
                {conv.unread > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#165DFF] text-white text-[10px] flex items-center justify-center shrink-0">
                    {conv.unread > 9 ? '9+' : conv.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* 消息区 */}
      <div className={`${!mobileShowConvs ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
        {!activePeerId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2">
            <MessageCircle className="w-12 h-12 text-gray-100" />
            <p className="text-sm text-gray-400">选择好友开始聊天</p>
          </div>
        ) : (
          <>
            <div className="h-12 px-3 flex items-center gap-2 border-b border-[#E5E6EB] shrink-0">
              <button onClick={() => setMobileShowConvs(true)} className="md:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Avatar className="w-7 h-7">
                <AvatarImage src={activePeer?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-[10px] font-medium">
                  {getInitials(activePeer?.full_name, activePeer?.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{displayName}</p>
                {activePeer?.school && <p className="text-[11px] text-gray-400">{activePeer.school}</p>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {msgsLoading ? (
                <div className="flex justify-center pt-6"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs">
                  <MessageCircle className="w-7 h-7 mx-auto mb-2 text-gray-200" />发送第一条消息吧！
                </div>
              ) : messages.map(msg => {
                const isMine = msg.sender_id === user!.id;
                return (
                  <div key={msg.id} className={`flex gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                      <AvatarImage src={isMine ? (profile?.avatar_url ?? undefined) : (activePeer?.avatar_url ?? undefined)} />
                      <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-[10px] font-medium">
                        {isMine ? getInitials(profile?.full_name, profile?.email) : getInitials(activePeer?.full_name, activePeer?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-400">{isMine ? myName : displayName}</span>
                      <div className={`px-2.5 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${
                        isMine ? 'bg-[#165DFF] text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}>{msg.content}</div>
                      <span className="text-[10px] text-gray-300">{timeStr(msg.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="px-3 py-2.5 border-t border-[#E5E6EB] flex gap-2 items-center shrink-0">
              <Input value={content} onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={`发消息给 ${displayName}…`} className="flex-1 h-9 text-sm rounded-xl" maxLength={1000} />
              <Button onClick={handleSend} disabled={sending || !content.trim()}
                className="h-9 px-3 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-xl shrink-0">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────
export default function FriendsPage() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialChatUserId = searchParams.get('chatWith');

  const [tab, setTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [recommendedUsers, setRecommendedUsers] = useState<PublicProfile[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(true);
  const [friends, setFriends] = useState<(Friendship & { profile: PublicProfile })[]>([]);
  const [pendingReceived, setPendingReceived] = useState<(Friendship & { profile: PublicProfile })[]>([]);
  const [pendingSent, setPendingSent] = useState<(Friendship & { profile: PublicProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(!!initialChatUserId);
  const [chatPeerId, setChatPeerId] = useState<string | null>(initialChatUserId);

  const [relationMap, setRelationMap] = useState<Record<string, { relation: 'pending_sent' | 'pending_received' | 'accepted'; id: string }>>({});

  const fetchFriendships = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: rows } = await supabase.from('friendships').select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!rows) { setLoading(false); return; }

    const profileIds = [...new Set(rows.map(r => r.user_id === user.id ? r.friend_id : r.user_id))];
    let profileMap: Record<string, PublicProfile> = {};
    if (profileIds.length) {
      const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', profileIds);
      ((profiles || []) as PublicProfile[]).forEach(p => { profileMap[p.id] = p; });
    }

    const newRelationMap: Record<string, { relation: 'pending_sent' | 'pending_received' | 'accepted'; id: string }> = {};
    const accepted: (Friendship & { profile: PublicProfile })[] = [];
    const rcvd: (Friendship & { profile: PublicProfile })[] = [];
    const sent: (Friendship & { profile: PublicProfile })[] = [];

    for (const r of rows) {
      const otherId = r.user_id === user.id ? r.friend_id : r.user_id;
      const p = profileMap[otherId] ?? { id: otherId, full_name: null, email: null, avatar_url: null, school: null, major: null, grade: null };
      const entry = { ...r, profile: p };
      if (r.status === 'accepted') {
        accepted.push(entry);
        newRelationMap[otherId] = { relation: 'accepted', id: r.id };
      } else if (r.status === 'pending') {
        if (r.user_id === user.id) { sent.push(entry); newRelationMap[otherId] = { relation: 'pending_sent', id: r.id }; }
        else { rcvd.push(entry); newRelationMap[otherId] = { relation: 'pending_received', id: r.id }; }
      }
    }

    setFriends(accepted);
    setPendingReceived(rcvd);
    setPendingSent(sent);
    setRelationMap(newRelationMap);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFriendships(); }, [fetchFriendships]);

  // 加载推荐用户（随机抽取最近注册用户，排除自己）
  const fetchRecommended = useCallback(async () => {
    if (!user) return;
    setRecommendLoading(true);
    const { data } = await supabase
      .from('public_profiles_with_stats')
      .select('id,full_name,email,avatar_url,school,major,grade,friend_count')
      .neq('id', user.id)
      .order('friend_count', { ascending: false })
      .limit(20);
    setRecommendedUsers((data as PublicProfile[]) || []);
    setRecommendLoading(false);
  }, [user]);

  useEffect(() => { fetchRecommended(); }, [fetchRecommended]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    // 先用 RPC 搜索，再补充 friend_count
    const { data: rpcData } = await supabase.rpc('get_public_profiles', { search_text: searchQuery.trim() });
    const ids: string[] = ((rpcData as PublicProfile[]) || []).map(p => p.id);
    if (ids.length === 0) { setSearchResults([]); setSearching(false); return; }
    const { data: withStats } = await supabase
      .from('public_profiles_with_stats')
      .select('id,full_name,email,avatar_url,school,major,grade,friend_count')
      .in('id', ids);
    setSearchResults((withStats as PublicProfile[]) || []);
    setSearching(false);
  };

  const handleSendRequest = async (targetId: string) => {
    const { error } = await supabase.from('friendships').insert({ user_id: user!.id, friend_id: targetId, status: 'pending' });
    if (error) { toast.error(error.code === '23505' ? '已经发送过好友请求' : '发送失败，请重试'); return; }
    toast.success('好友请求已发送');
    fetchFriendships();
  };

  const handleAccept = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    if (error) { toast.error('操作失败'); return; }
    toast.success('已成为好友 🎉');
    fetchFriendships();
    setTab('friends');
  };

  const handleDecline = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').update({ status: 'rejected' }).eq('id', friendshipId);
    if (error) { toast.error('操作失败'); return; }
    toast.info('已拒绝请求');
    fetchFriendships();
  };

  const handleRemove = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) { toast.error('删除失败'); return; }
    toast.success('已删除好友');
    fetchFriendships();
  };

  const handleOpenChat = (uid: string) => { setChatPeerId(uid); setChatOpen(true); };

  const getRelation = (uid: string) => relationMap[uid]?.relation ?? 'none';
  const getRelationId = (uid: string) => relationMap[uid]?.id;

  return (
    <Layout>
      {/* 页头 */}
      <div className="relative rounded-2xl overflow-hidden mb-6 min-h-[140px]"
        style={{ background: 'linear-gradient(135deg, #4318D1 0%, #7C3AED 55%, #a78bfa 100%)' }}>
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative z-10 px-6 md:px-10 py-8 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-white text-balance">好友广场</h1>
            <p className="text-white/70 text-sm mt-1">结交同学，分享学习动态</p>
          </div>
          <div className="flex gap-3 shrink-0">
            {[
              { label: '好友', value: friends.length, color: 'bg-white/15' },
              { label: '待处理', value: pendingReceived.length, color: pendingReceived.length > 0 ? 'bg-yellow-400/30' : 'bg-white/15' },
              { label: '已发出', value: pendingSent.length, color: 'bg-white/15' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`flex flex-col items-center px-4 py-3 rounded-xl ${color} backdrop-blur-sm`}>
                <p className="text-white text-xl font-bold">{value}</p>
                <p className="text-white/70 text-[11px]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 主内容区：好友列表 + 可折叠私聊面板 */}
      <div className={`grid gap-5 transition-all ${chatOpen ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* 左：搜索找人 + 推荐用户 */}
        <div className={chatOpen ? 'lg:col-span-1' : 'lg:col-span-1'}>
          <Card className="border-[#E5E6EB] shadow-sm sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Search className="text-[#165DFF]" style={{ width: 18, height: 18 }} />搜索同学
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input placeholder="姓名、学校、专业…" value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setSearchResults([]); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="flex-1 h-9 text-sm" />
                <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
                  className="h-9 px-3 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white shrink-0">
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              {/* 搜索结果 */}
              {searching && <p className="text-sm text-gray-400 text-center py-4">搜索中…</p>}
              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-sm text-gray-400 text-center py-4">未找到匹配用户</p>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
                  {searchResults.map(p => (
                    <UserCard key={p.id} profile={p} relation={getRelation(p.id)} friendshipId={getRelationId(p.id)}
                      onSendRequest={handleSendRequest} onAccept={handleAccept} onDecline={handleDecline} onRemove={handleRemove}
                      onChat={handleOpenChat} />
                  ))}
                </div>
              )}

              {/* 未搜索时展示推荐用户 */}
              {!searchQuery && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />最近加入的同学
                  </p>
                  {recommendLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                      ))}
                    </div>
                  ) : recommendedUsers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">暂无其他用户</p>
                  ) : (
                    <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-0.5">
                      {recommendedUsers.map(p => (
                        <UserCard key={p.id} profile={p} relation={getRelation(p.id)} friendshipId={getRelationId(p.id)}
                          onSendRequest={handleSendRequest} onAccept={handleAccept} onDecline={handleDecline} onRemove={handleRemove}
                          onChat={handleOpenChat} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 中：好友 Tabs */}
        <div className={chatOpen ? 'lg:col-span-2' : 'lg:col-span-2'}>
          <Tabs value={tab} onValueChange={v => { setTab(v); if (v === 'chat') setChatOpen(true); }}>
            <TabsList className="mb-4 bg-[#F5F7FA] rounded-xl h-10">
              <TabsTrigger value="friends" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                好友{friends.length > 0 && <Badge className="ml-1.5 bg-[#165DFF]/10 text-[#165DFF] border-0 text-[11px] h-5 px-1.5">{friends.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <MessageCircle className="w-3.5 h-3.5 mr-1" />私聊
              </TabsTrigger>
              <TabsTrigger value="received" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                待处理{pendingReceived.length > 0 && <Badge className="ml-1.5 bg-yellow-100 text-yellow-700 border-0 text-[11px] h-5 px-1.5">{pendingReceived.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="sent" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                已发出{pendingSent.length > 0 && <Badge className="ml-1.5 bg-gray-100 text-gray-500 border-0 text-[11px] h-5 px-1.5">{pendingSent.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends">
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
              ) : friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-3">
                    <Users className="w-8 h-8 text-purple-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">暂无好友</p>
                  <p className="text-xs text-gray-400 mt-1">在左侧搜索同学，发送好友请求</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(f => (
                    <UserCard key={f.id} profile={f.profile} relation="accepted" friendshipId={f.id}
                      onSendRequest={handleSendRequest} onAccept={handleAccept} onDecline={handleDecline} onRemove={handleRemove}
                      onChat={(uid) => { handleOpenChat(uid); setTab('chat'); }} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 独立私聊 tab 内嵌面板 */}
            <TabsContent value="chat">
              <Card className="border-[#E5E6EB] shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: 460 }}>
                <ChatPanel user={user} profile={profile} initialPeerId={chatPeerId} friends={friends}
                  onClose={() => { setTab('friends'); setChatOpen(false); setChatPeerId(null); }} />
              </Card>
            </TabsContent>

            <TabsContent value="received">
              {pendingReceived.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-3">
                    <UserCheck className="w-8 h-8 text-green-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">暂无待处理请求</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingReceived.map(f => (
                    <UserCard key={f.id} profile={f.profile} relation="pending_received" friendshipId={f.id}
                      onSendRequest={handleSendRequest} onAccept={handleAccept} onDecline={handleDecline} onRemove={handleRemove} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent">
              {pendingSent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                    <ChevronRight className="w-8 h-8 text-blue-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">暂无已发出的请求</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingSent.map(f => (
                    <UserCard key={f.id} profile={f.profile} relation="pending_sent" friendshipId={f.id}
                      onSendRequest={handleSendRequest} onAccept={handleAccept} onDecline={handleDecline} onRemove={handleRemove} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* 右：浮动私聊面板（桌面端宽屏展开，tab 内嵌已替代） */}
        {chatOpen && tab !== 'chat' && (
          <div className="lg:col-span-2">
            <Card className="border-[#E5E6EB] shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}>
              <ChatPanel user={user} profile={profile} initialPeerId={chatPeerId} friends={friends}
                onClose={() => { setChatOpen(false); setChatPeerId(null); }} />
            </Card>
          </div>
        )}
        {!chatOpen && tab !== 'chat' && (
          <div className="lg:hidden" />
        )}
      </div>
    </Layout>
  );
}
