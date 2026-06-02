import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Plus, Send, Loader2, BookOpen, LogOut,
  MessageSquare, Crown, ArrowLeft, CheckSquare, CalendarDays,
  Flame, Trophy, ClipboardList, Paperclip, UserPlus, Clock,
  Upload, FileText, Trash2, Bell, UserCheck, VolumeX, Volume2, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import LoginPromptModal from '@/components/LoginPromptModal';
import type { PublicProfile, GroupTask, GroupFile, GroupInvitation } from '@/types/types';
import { useBanStatus } from '@/hooks/useBanStatus';
import { useKeywordFilter } from '@/hooks/useKeywordFilter';

interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  max_members: number;
  owner_id: string;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
  announcement?: string | null;
  announcement_updated_at?: string | null;
}

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface GroupCheckin {
  id: string;
  group_id: string;
  user_id: string;
  note: string | null;
  checked_at: string;
  created_at: string;
}

interface CheckinStat {
  userId: string;
  profile: PublicProfile | null;
  total: number;
  streak: number;
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

export default function StudyGroupsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isBanned } = useBanStatus();
  const { checkContent } = useKeywordFilter();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<StudyGroup | null>(null);
  const [members, setMembers] = useState<PublicProfile[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, PublicProfile>>({});
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', subject: '', max_members: '10' });
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // 详情面板 tab — 新增 members + announcement
  const [detailTab, setDetailTab] = useState<'chat' | 'checkin' | 'tasks' | 'files' | 'invite' | 'members' | 'announcement'>('chat');
  // 公告编辑状态
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  // 成员角色映射 { userId -> { role, is_muted } }
  const [memberRoles, setMemberRoles] = useState<Record<string, { role: string; is_muted: boolean }>>({});
  // 我和谁是好友的映射
  const [friendSet, setFriendSet] = useState<Set<string>>(new Set());
  // 查看资料弹窗
  const [viewProfile, setViewProfile] = useState<PublicProfile | null>(null);
  // 打卡相关
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [todayCheckins, setTodayCheckins] = useState<(GroupCheckin & { profile: PublicProfile | null })[]>([]);
  const [checkinStats, setCheckinStats] = useState<CheckinStat[]>([]);
  const [myCheckinId, setMyCheckinId] = useState<string | null>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const [doingCheckin, setDoingCheckin] = useState(false);
  // 任务相关
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '', task_type: 'task' as 'task' | 'homework' });
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  // 文件相关
  const [files, setFiles] = useState<GroupFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 邀请相关
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<GroupInvitation[]>([]);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const { data: allGroups } = await supabase
      .from('study_groups')
      .select('*')
      .order('created_at', { ascending: false });

    // 获取成员数
    const { data: memberCounts } = await supabase
      .from('group_members')
      .select('group_id');

    const countMap: Record<string, number> = {};
    (memberCounts || []).forEach((m: { group_id: string }) => {
      countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
    });

    // 当前用户所在小组
    let myGroupIds = new Set<string>();
    if (user) {
      const { data: myMemberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
      (myMemberships || []).forEach((m: { group_id: string }) => myGroupIds.add(m.group_id));
    }

    setGroups((allGroups || []).map((g: StudyGroup) => ({
      ...g,
      member_count: countMap[g.id] || 0,
      is_member: myGroupIds.has(g.id),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const loadGroupDetail = useCallback(async (group: StudyGroup) => {
    setActiveGroup(group);
    setDetailTab('chat');
    setMsgsLoading(true);

    // 获取成员列表（含角色和禁言状态）
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('user_id, role, is_muted')
      .eq('group_id', group.id);

    const uids = (memberRows || []).map((m: { user_id: string }) => m.user_id);
    const roleMap: Record<string, { role: string; is_muted: boolean }> = {};
    (memberRows || []).forEach((m: { user_id: string; role: string; is_muted: boolean }) => {
      roleMap[m.user_id] = { role: m.role, is_muted: m.is_muted };
    });
    setMemberRoles(roleMap);

    let pMap: Record<string, PublicProfile> = {};
    if (uids.length) {
      const { data: profiles } = await supabase
        .from('public_profiles').select('*').in('id', uids);
      (profiles || []).forEach((p: PublicProfile) => { pMap[p.id] = p; });
    }
    setProfileMap(pMap);
    setMembers(uids.map((id: string) => pMap[id]).filter(Boolean));

    // 加载当前用户的好友集合
    if (user) {
      const { data: friendRows } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');
      const fs = new Set<string>();
      (friendRows || []).forEach((r: { user_id: string; friend_id: string }) => {
        fs.add(r.user_id === user.id ? r.friend_id : r.user_id);
      });
      setFriendSet(fs);
    }

    // 获取讨论消息
    const { data: msgs } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: true });
    setMessages((msgs as GroupMessage[]) || []);
    setMsgsLoading(false);
    // 打卡数据在 loadCheckins 定义后通过 useEffect 触发
  }, [user]);

  // 打卡日期范围选择（默认近30天）
  const [checkinDays, setCheckinDays] = useState(30);
  // 热力图数据：date -> count
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});

  // 加载打卡数据
  const loadCheckins = useCallback(async (groupId: string, days = 30) => {
    if (!user) return;
    setCheckinLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // 今日打卡列表
    const { data: todayData } = await supabase
      .from('group_checkins')
      .select('*')
      .eq('group_id', groupId)
      .eq('checked_at', today)
      .order('created_at', { ascending: true });

    const pIds = [...new Set((todayData || []).map((c: GroupCheckin) => c.user_id))];
    const pMap: Record<string, PublicProfile> = {};
    if (pIds.length) {
      const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', pIds);
      (profiles || []).forEach((p: PublicProfile) => { pMap[p.id] = p; });
    }
    const enriched = (todayData || []).map((c: GroupCheckin) => ({ ...c, profile: pMap[c.user_id] || null }));
    setTodayCheckins(enriched);
    setMyCheckinId(enriched.find((c: GroupCheckin) => c.user_id === user.id)?.id ?? null);

    // 按选定日期范围统计
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - days + 1);
    const rangeStartStr = rangeStart.toISOString().slice(0, 10);

    const { data: histData } = await supabase
      .from('group_checkins')
      .select('user_id, checked_at')
      .eq('group_id', groupId)
      .gte('checked_at', rangeStartStr)
      .order('checked_at', { ascending: false });

    // 热力图：date → 打卡人次
    const dateCountMap: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      dateCountMap[d.toISOString().slice(0, 10)] = 0;
    }
    (histData || []).forEach((c: { checked_at: string }) => {
      if (dateCountMap[c.checked_at] !== undefined)
        dateCountMap[c.checked_at]++;
    });
    setHeatmapData(dateCountMap);


    // 成员打卡统计
    const userCountMap: Record<string, number> = {};
    (histData || []).forEach((c: { user_id: string }) => {
      userCountMap[c.user_id] = (userCountMap[c.user_id] || 0) + 1;
    });

    // 连续打卡计算
    const userDateMap: Record<string, Set<string>> = {};
    (histData || []).forEach((c: { user_id: string; checked_at: string }) => {
      if (!userDateMap[c.user_id]) userDateMap[c.user_id] = new Set();
      userDateMap[c.user_id].add(c.checked_at);
    });
    const calcStreak = (dates: Set<string>): number => {
      let streak = 0;
      const d = new Date();
      while (true) {
        const key = d.toISOString().slice(0, 10);
        if (dates.has(key)) { streak++; d.setDate(d.getDate() - 1); }
        else break;
      }
      return streak;
    };

    const allMemberIds = Object.keys(userCountMap);
    const memberPMap: Record<string, PublicProfile> = {};
    if (allMemberIds.length) {
      const { data: mp } = await supabase.from('public_profiles').select('*').in('id', allMemberIds);
      (mp || []).forEach((p: PublicProfile) => { memberPMap[p.id] = p; });
    }

    const stats: CheckinStat[] = allMemberIds
      .map(uid => ({ userId: uid, profile: memberPMap[uid] || null, total: userCountMap[uid], streak: calcStreak(userDateMap[uid]) }))
      .sort((a, b) => b.total - a.total);
    setCheckinStats(stats);
    setCheckinLoading(false);
  }, [user]);

  // 执行打卡
  const handleCheckin = async () => {
    if (!user || !activeGroup) return;
    if (isBanned) { toast.error('你的账号已被封禁，无法打卡'); return; }
    if (!activeGroup.is_member) { toast.error('请先加入小组才能打卡'); return; }
    setDoingCheckin(true);
    const { data, error } = await supabase.from('group_checkins')
      .insert({ group_id: activeGroup.id, user_id: user.id, note: checkinNote.trim() || null })
      .select().maybeSingle();
    setDoingCheckin(false);
    if (error) {
      if (error.code === '23505') toast.error('今日已打卡！');
      else toast.error('打卡失败：' + error.message);
      return;
    }
    toast.success('打卡成功 🎉');
    setCheckinNote('');
    if (data) setMyCheckinId(data.id);
    loadCheckins(activeGroup.id);
  };

  // 取消打卡
  const handleCancelCheckin = async () => {
    if (!myCheckinId || !activeGroup) return;
    setDoingCheckin(true);
    const { error } = await supabase.from('group_checkins').delete().eq('id', myCheckinId);
    setDoingCheckin(false);
    if (error) { toast.error('取消失败'); return; }
    toast.info('已取消今日打卡');
    setMyCheckinId(null);
    loadCheckins(activeGroup.id);
  };

  // ── 任务/作业 ─────────────────────────────────────
  const loadTasks = useCallback(async (groupId: string) => {
    setTasksLoading(true);
    const { data } = await supabase.from('group_tasks').select('*')
      .eq('group_id', groupId).order('created_at', { ascending: false });
    setTasks((data as GroupTask[]) || []);
    setTasksLoading(false);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeGroup) return;
    if (isBanned) { toast.error('你的账号已被封禁，无法发布任务'); return; }
    if (!taskForm.title.trim()) { toast.error('请填写任务标题'); return; }
    setCreatingTask(true);
    const { error } = await supabase.from('group_tasks').insert({
      group_id: activeGroup.id, creator_id: user.id,
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      due_date: taskForm.due_date || null,
      task_type: taskForm.task_type,
    });
    setCreatingTask(false);
    if (error) { toast.error('发布失败：' + error.message); return; }
    toast.success('任务已发布');
    setTaskForm({ title: '', description: '', due_date: '', task_type: 'task' });
    setTaskDialogOpen(false);
    loadTasks(activeGroup.id);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeGroup) return;
    await supabase.from('group_tasks').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast.success('已删除任务');
  };

  // ── 文件分享 ─────────────────────────────────────
  const loadFiles = useCallback(async (groupId: string) => {
    setFilesLoading(true);
    const now = new Date().toISOString();
    const { data } = await supabase.from('group_files').select('*')
      .eq('group_id', groupId).gte('expires_at', now)
      .order('created_at', { ascending: false });
    const filesData = (data as GroupFile[]) || [];
    if (filesData.length) {
      const ids = [...new Set(filesData.map(f => f.uploader_id))];
      const { data: profiles } = await supabase.from('public_profiles').select('id,full_name').in('id', ids);
      const nm = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || '同学']));
      filesData.forEach(f => { f.uploader_name = nm[f.uploader_id] || '同学'; });
    }
    setFiles(filesData);
    setFilesLoading(false);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !activeGroup) return;
    if (isBanned) { toast.error('你的账号已被封禁，无法上传文件'); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('文件大小不能超过 20MB'); return; }
    setUploadingFile(true);
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${activeGroup.id}/${user.id}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('group-files').upload(path, file);
    if (upErr) { setUploadingFile(false); toast.error('上传失败：' + upErr.message); return; }
    const { data: urlData } = supabase.storage.from('group-files').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('group_files').insert({
      group_id: activeGroup.id, uploader_id: user.id,
      file_name: file.name, file_url: urlData.publicUrl, file_size: file.size,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    setUploadingFile(false);
    if (dbErr) { toast.error('记录保存失败'); return; }
    toast.success('文件上传成功，有效期7天');
    loadFiles(activeGroup.id);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    // 从 URL 提取路径
    const path = fileUrl.split('/group-files/')[1];
    if (path) await supabase.storage.from('group-files').remove([path]);
    await supabase.from('group_files').delete().eq('id', fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success('文件已删除');
  };

  // ── 邀请好友 ─────────────────────────────────────
  const loadInviteData = useCallback(async (groupId: string) => {
    if (!user) return;
    setInviteLoading(true);
    // 查好友列表（双向：user_id 或 friend_id 均可能是自己）
    const { data: friendsData } = await supabase
      .from('friendships')
      .select('user_id,friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');
    const friendIds = (friendsData || []).map((f: { user_id: string; friend_id: string }) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    );
    let fList: PublicProfile[] = [];
    if (friendIds.length) {
      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('id,full_name,email,avatar_url')
        .in('id', friendIds);
      fList = (profilesData as PublicProfile[]) || [];
    }
    setFriends(fList);
    // 查当前小组的邀请记录
    const { data: invData } = await supabase
      .from('group_invitations').select('*').eq('group_id', groupId);
    setInvitations((invData as GroupInvitation[]) || []);
    // 我收到的待处理邀请（此小组）
    const { data: myInvData } = await supabase
      .from('group_invitations').select('*')
      .eq('invitee_id', user.id).eq('status', 'pending').eq('group_id', groupId);
    setPendingInvites((myInvData as GroupInvitation[]) || []);
    setInviteLoading(false);
  }, [user]);

  const handleInvite = async (friendId: string) => {
    if (!user || !activeGroup) return;
    const { error } = await supabase.from('group_invitations').insert({
      group_id: activeGroup.id, inviter_id: user.id, invitee_id: friendId,
    });
    if (error?.code === '23505') { toast.info('已发送过邀请'); return; }
    if (error) { toast.error('邀请失败'); return; }
    toast.success('邀请已发送');
    loadInviteData(activeGroup.id);
  };

  const handleAcceptInvite = async (inv: GroupInvitation) => {
    if (!user) return;
    await supabase.from('group_invitations').update({ status: 'accepted' }).eq('id', inv.id);
    await supabase.from('group_members').insert({ group_id: inv.group_id, user_id: user.id, role: 'member' });
    toast.success('已接受邀请并加入小组');
    setPendingInvites(prev => prev.filter(i => i.id !== inv.id));
    loadGroups();
  };

  const handleRejectInvite = async (invId: string) => {
    await supabase.from('group_invitations').update({ status: 'rejected' }).eq('id', invId);
    setPendingInvites(prev => prev.filter(i => i.id !== invId));
    toast.info('已拒绝邀请');
  };

  // 打开小组时加载打卡数据
  useEffect(() => {
    if (activeGroup && user) {
      loadCheckins(activeGroup.id, checkinDays);
      loadTasks(activeGroup.id);
      loadFiles(activeGroup.id);
      loadInviteData(activeGroup.id);
    }
  }, [activeGroup, user, loadCheckins, loadTasks, loadFiles, loadInviteData, checkinDays]);

  // Realtime 订阅小组消息
  useEffect(() => {
    if (!activeGroup) return;
    const channel = supabase
      .channel(`group:${activeGroup.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${activeGroup.id}`,
      }, (payload) => {
        const msg = payload.new as GroupMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${activeGroup.id}`,
      }, (payload) => {
        const old = payload.old as { id: string };
        setMessages(prev => prev.filter(m => m.id !== old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroup]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [messages]);

  // 保存小组公告
  const handleSaveAnnouncement = async () => {
    if (!activeGroup || !user) return;
    const { error } = await supabase.from('study_groups')
      .update({ announcement: announcementDraft.trim() || null, announcement_updated_at: new Date().toISOString() })
      .eq('id', activeGroup.id);
    if (error) { toast.error('保存公告失败'); return; }
    setActiveGroup({ ...activeGroup, announcement: announcementDraft.trim() || null, announcement_updated_at: new Date().toISOString() });
    setEditingAnnouncement(false);
    toast.success('公告已更新');
  };

  // 小组长踢出成员
  const handleKickMember = async (targetId: string) => {
    if (!activeGroup || !user) return;
    if (!confirm(`确定要将该成员移出小组吗？`)) return;
    const { error } = await supabase.from('group_members')
      .delete().eq('group_id', activeGroup.id).eq('user_id', targetId);
    if (error) { toast.error('操作失败'); return; }
    toast.success('已移出成员');
    loadGroupDetail(activeGroup);
    loadGroups();
  };

  // 小组长禁言/解禁成员
  const handleToggleMute = async (targetId: string, currentMuted: boolean) => {
    if (!activeGroup || !user) return;
    const { error } = await supabase.from('group_members')
      .update({ is_muted: !currentMuted })
      .eq('group_id', activeGroup.id).eq('user_id', targetId);
    if (error) { toast.error('操作失败'); return; }
    toast.success(currentMuted ? '已解除禁言' : '已禁言该成员');
    setMemberRoles(prev => ({
      ...prev,
      [targetId]: { ...prev[targetId], is_muted: !currentMuted },
    }));
  };

  // 发送好友请求
  const handleAddFriend = async (targetId: string) => {
    if (!user) { setLoginPrompt(true); return; }
    const { error } = await supabase.from('friendships').insert({
      user_id: user.id, friend_id: targetId, status: 'pending',
    });
    if (error) { toast.error(error.code === '23505' ? '已发送过好友请求' : '发送失败'); return; }
    toast.success('好友请求已发送');
    setFriendSet(prev => new Set([...prev])); // trigger refresh handled on next load
  };

  const handleJoin = async (group: StudyGroup) => {
    if (!user) { setLoginPrompt(true); return; }
    if ((group.member_count || 0) >= group.max_members) {
      toast.error('小组已满员');
      return;
    }
    const { error } = await supabase.from('group_members').insert({
      group_id: group.id, user_id: user.id, role: 'member',
    });
    if (error) { toast.error('加入失败：' + error.message); return; }
    toast.success('已加入小组');
    loadGroups();
  };

  const handleLeave = async (group: StudyGroup) => {
    if (!user) return;
    if (group.owner_id === user.id) {
      toast.error('组长需先转让或解散小组才能退出');
      return;
    }
    const { error } = await supabase.from('group_members')
      .delete().eq('group_id', group.id).eq('user_id', user.id);
    if (error) { toast.error('退出失败'); return; }
    toast.success('已退出小组');
    if (activeGroup?.id === group.id) setActiveGroup(null);
    loadGroups();
  };

  const handleSendMessage = async () => {
    if (!user || !activeGroup || !content.trim()) return;
    if (isBanned) { toast.error('你的账号已被封禁，无法发送消息'); return; }
    // 检查是否被禁言
    if (memberRoles[user.id]?.is_muted) {
      toast.error('你已被禁言，无法发送消息');
      return;
    }
    // 关键词检测
    const hits = await checkContent(content);
    if (hits.length > 0) { toast.error(`消息包含违禁词：${hits.slice(0, 3).join('、')}，请修改后发送`); return; }
    setSending(true);
    const { error } = await supabase.from('group_messages').insert({
      group_id: activeGroup.id, user_id: user.id, content: content.trim(),
    });
    setSending(false);
    if (error) { toast.error('发送失败'); return; }
    setContent('');
  };

  // 撤回消息（仅限 2 分钟内自己的消息）
  const handleRetractMessage = async (msgId: string, createdAt: string) => {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs > 2 * 60 * 1000) {
      toast.error('只能撤回 2 分钟内发送的消息');
      return;
    }
    const { error } = await supabase.from('group_messages').delete().eq('id', msgId);
    if (error) { toast.error('撤回失败'); return; }
    toast.success('消息已撤回');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setLoginPrompt(true); return; }
    if (!form.name.trim()) { toast.error('请填写小组名称'); return; }
    setCreating(true);
    const { data: newGroup, error } = await supabase.from('study_groups').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      subject: form.subject.trim() || null,
      max_members: parseInt(form.max_members) || 10,
      owner_id: user.id,
    }).select().maybeSingle();
    if (error || !newGroup) { setCreating(false); toast.error('创建失败：' + error?.message); return; }
    // 自动加入
    await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: user.id, role: 'owner' });
    setCreating(false);
    setCreateOpen(false);
    setForm({ name: '', description: '', subject: '', max_members: '10' });
    toast.success('小组创建成功');
    loadGroups();
  };

  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-[#165DFF]" />小组学习
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">与志同道合的同学组建学习小组，共同进步</p>
          </div>
          <Button
            onClick={() => { if (!user) { setLoginPrompt(true); return; } setCreateOpen(true); }}
            className="h-9 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" />创建小组
          </Button>
        </div>

        <div className="flex gap-6 h-[calc(100vh-240px)] min-h-[500px]">
          {/* ── 小组列表 ────────────────────────────────────── */}
          <div className={`${activeGroup ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 shrink-0 gap-3 overflow-y-auto pr-1`}>
            {loading && (
              <div className="flex justify-center pt-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            )}
            {!loading && groups.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">暂无小组，快来创建第一个！</p>
              </div>
            )}
            {groups.map(group => (
              <Card
                key={group.id}
                className={`cursor-pointer hover:shadow-md transition-shadow h-full ${activeGroup?.id === group.id ? 'ring-2 ring-[#165DFF]' : ''}`}
                onClick={() => {
                  if (!user && group.is_member !== true) {
                    // 未登录可查看小组信息，点击讨论区要求登录
                  }
                  loadGroupDetail(group);
                }}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-gray-800 text-balance leading-snug line-clamp-1">
                      {group.name}
                    </CardTitle>
                    {group.subject && (
                      <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs shrink-0">{group.subject}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {group.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3 text-pretty">{group.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {group.member_count}/{group.max_members} 人
                    </span>
                    {user && group.is_member ? (
                      <button
                        onClick={e => { e.stopPropagation(); handleLeave(group); }}
                        className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-0.5"
                      >
                        <LogOut className="w-3 h-3" />退出
                      </button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={e => { e.stopPropagation(); handleJoin(group); }}
                        disabled={(group.member_count || 0) >= group.max_members}
                        className="h-6 px-2 text-xs bg-[#165DFF] hover:bg-[#165DFF]/90 text-white"
                      >
                        {(group.member_count || 0) >= group.max_members ? '已满' : '加入'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── 小组详情 + 讨论区/打卡 ──────────────────── */}
          {activeGroup ? (
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-[#E5E6EB] flex flex-col overflow-hidden">
              {/* 头部 */}
              <div className="h-14 px-4 flex items-center gap-3 border-b border-[#E5E6EB]">
                <button
                  onClick={() => setActiveGroup(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <BookOpen className="w-4 h-4 text-[#165DFF] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{activeGroup.name}</p>
                  {activeGroup.subject && (
                    <p className="text-xs text-gray-400">{activeGroup.subject}</p>
                  )}
                </div>
                {/* 成员头像堆叠 */}
                <div className="hidden md:flex -space-x-2">
                  {members.slice(0, 5).map(m => (
                    <Avatar key={m.id} className="w-6 h-6 ring-2 ring-white">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[8px] bg-[#165DFF]/10 text-[#165DFF]">
                        {getInitials(m.full_name, m.email)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {members.length > 5 && (
                    <div className="w-6 h-6 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center">
                      <span className="text-[8px] text-gray-500">+{members.length - 5}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400 ml-1">{members.length}/{activeGroup.max_members}人</span>
              </div>

              {/* 讨论 / 打卡 / 任务 / 文件 / 邀请 / 成员 / 公告 Tab */}
              {/* 置顶公告横幅 */}
              {activeGroup.announcement && detailTab !== 'announcement' && (
                <button
                  onClick={() => setDetailTab('announcement')}
                  className="mx-4 mt-2 mb-0 flex items-start gap-2 p-2.5 rounded-lg bg-yellow-50 border border-yellow-200 text-left hover:bg-yellow-100 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800 line-clamp-1 flex-1 min-w-0">{activeGroup.announcement}</p>
                  <ChevronRight className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                </button>
              )}
              <div className="flex border-b border-[#E5E6EB] bg-gray-50/50 shrink-0 overflow-x-auto mt-2">
                {([
                  { key: 'chat', label: '讨论', icon: MessageSquare },
                  { key: 'checkin', label: '打卡', icon: CheckSquare, badge: todayCheckins.length },
                  { key: 'tasks', label: '任务', icon: ClipboardList, badge: tasks.length },
                  { key: 'files', label: '文件', icon: Paperclip, badge: files.length },
                  { key: 'invite', label: '邀请', icon: UserPlus, badge: pendingInvites.length },
                  { key: 'members', label: '成员', icon: Users, badge: members.length },
                  { key: 'announcement', label: '公告', icon: Bell },
                ] as { key: typeof detailTab; label: string; icon: React.ElementType; badge?: number }[]).map(({ key, label, icon: Icon, badge }) => (
                  <button key={key} onClick={() => setDetailTab(key)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-w-[60px] ${
                      detailTab === key
                        ? 'text-[#165DFF] border-b-2 border-[#165DFF] bg-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                    {badge && badge > 0 ? (
                      <span className="bg-[#165DFF]/10 text-[#165DFF] text-[10px] rounded-full px-1 font-semibold">{badge}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* 成员（小屏折叠） */}
              <div className="md:hidden px-4 py-2 border-b border-[#E5E6EB] bg-gray-50 flex items-center gap-2 overflow-x-auto">
                {members.slice(0, 8).map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 shrink-0">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[8px] bg-[#165DFF]/10 text-[#165DFF]">
                        {getInitials(m.full_name, m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-600 max-w-[4rem] truncate">
                      {m.full_name || m.email?.split('@')[0]}
                      {m.id === activeGroup.owner_id && (
                        <Crown className="w-2.5 h-2.5 text-yellow-500 inline ml-0.5" />
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/* 讨论消息 (chat tab) */}
              {detailTab === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {msgsLoading ? (
                      <div className="flex justify-center pt-8">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                        暂无讨论，{activeGroup.is_member ? '来发起第一条消息吧！' : '加入小组后参与讨论'}
                      </div>
                    ) : (
                      messages.map(msg => {
                        const p = profileMap[msg.user_id];
                        const isMine = user?.id === msg.user_id;
                        const name = p?.full_name || p?.email?.split('@')[0] || '同学';
                        // 发送时间距现在是否在 2 分钟内
                        const canRetract = isMine && (Date.now() - new Date(msg.created_at).getTime()) < 2 * 60 * 1000;
                        return (
                          <div key={msg.id} className={`flex gap-2 group ${isMine ? 'flex-row-reverse' : ''}`}>
                            <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                              <AvatarImage src={p?.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-[10px]">
                                {getInitials(p?.full_name, p?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`flex flex-col gap-0.5 max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400">{name}</span>
                                {msg.user_id === activeGroup.owner_id && (
                                  <Crown className="w-2.5 h-2.5 text-yellow-500" />
                                )}
                                <span className="text-[10px] text-gray-300">{timeAgo(msg.created_at)}</span>
                              </div>
                              <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                                  isMine ? 'bg-[#165DFF] text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                                }`}>{msg.content}</div>
                                {/* 撤回按钮：仅本人 2 分钟内可见（hover 显示） */}
                                {canRetract && (
                                  <button
                                    onClick={() => handleRetractMessage(msg.id, msg.created_at)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 hover:text-red-400 whitespace-nowrap shrink-0 mb-0.5"
                                    title="撤回消息（2分钟内有效）"
                                  >
                                    撤回
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* 输入区 */}
                  {user && activeGroup.is_member ? (
                    <div className="px-4 py-3 border-t border-[#E5E6EB] flex gap-2 items-center">
                      <Input value={content} onChange={e => setContent(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder="在小组讨论区发言…（Enter 发送）" className="flex-1 h-10 text-sm rounded-xl" maxLength={500} />
                      <Button onClick={handleSendMessage} disabled={sending || !content.trim()}
                        className="h-10 px-4 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white rounded-xl gap-1.5 shrink-0">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="hidden sm:inline">发送</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="px-4 py-3 border-t border-[#E5E6EB] text-center text-sm text-gray-400">
                      {user
                        ? <button onClick={() => handleJoin(activeGroup)} className="text-[#165DFF] hover:underline">加入小组后参与讨论</button>
                        : <button onClick={() => setLoginPrompt(true)} className="text-[#165DFF] hover:underline">登录后加入小组参与讨论</button>}
                    </div>
                  )}
                </>
              )}

              {/* 打卡面板 (checkin tab) */}
              {detailTab === 'checkin' && (
                <div className="flex-1 overflow-y-auto">
                  {checkinLoading ? (
                    <div className="flex justify-center pt-12"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                  ) : (
                    <div className="px-4 py-4 space-y-4">
                      {/* 今日打卡操作区 */}
                      <div className={`rounded-xl p-4 border ${myCheckinId ? 'bg-green-50 border-green-200' : 'bg-[#165DFF]/5 border-[#165DFF]/20'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <CalendarDays className={`w-4 h-4 ${myCheckinId ? 'text-green-500' : 'text-[#165DFF]'}`} />
                            <span className="text-sm font-semibold text-gray-800">
                              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} 打卡
                            </span>
                          </div>
                          <Badge className={myCheckinId ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-500 border-0'}>
                            {myCheckinId ? '✓ 已打卡' : '未打卡'}
                          </Badge>
                        </div>
                        {!myCheckinId && user && activeGroup.is_member && (
                          <div className="flex gap-2">
                            <Input value={checkinNote} onChange={e => setCheckinNote(e.target.value)}
                              placeholder="打卡备注（可选）" className="flex-1 h-9 text-sm" maxLength={100} />
                            <Button onClick={handleCheckin} disabled={doingCheckin}
                              className="h-9 px-4 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white text-sm shrink-0 gap-1.5">
                              {doingCheckin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}打卡
                            </Button>
                          </div>
                        )}
                        {myCheckinId && (
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-green-600 flex items-center gap-1.5">
                              <CheckSquare className="w-4 h-4" />今日已完成打卡，继续加油！
                            </p>
                            <button onClick={handleCancelCheckin} disabled={doingCheckin}
                              className="text-xs text-gray-400 hover:text-red-400 transition-colors">取消打卡</button>
                          </div>
                        )}
                        {user && !activeGroup.is_member && <p className="text-xs text-gray-400 mt-1">加入小组后才能打卡</p>}
                        {!user && (
                          <button onClick={() => setLoginPrompt(true)} className="text-xs text-[#165DFF] hover:underline mt-1 block">登录后打卡</button>
                        )}
                      </div>

                      {/* 今日打卡成员 */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />今日打卡成员（{todayCheckins.length}人）
                        </p>
                        {todayCheckins.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2 text-center">今天还没有成员打卡，快来第一个！</p>
                        ) : (
                          <div className="space-y-1.5">
                            {todayCheckins.map((c) => {
                              const name = c.profile?.full_name || c.profile?.email?.split('@')[0] || '同学';
                              return (
                                <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50">
                                  <Avatar className="w-7 h-7 shrink-0">
                                    <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                                    <AvatarFallback className="bg-green-100 text-green-700 text-[10px] font-medium">
                                      {getInitials(c.profile?.full_name, c.profile?.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-gray-700">{name}</span>
                                    {c.note && <p className="text-[11px] text-gray-400 truncate">{c.note}</p>}
                                  </div>
                                  <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(c.created_at)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 打卡热力图 + 日期范围切换 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />打卡热力图
                          </p>
                          <div className="flex gap-1">
                            {([7, 30, 90] as const).map(d => (
                              <button key={d} onClick={() => setCheckinDays(d)}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                                  checkinDays === d ? 'bg-[#165DFF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}>
                                {d}天
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* 热力方格图 */}
                        <div className="bg-gray-50 rounded-xl p-3 overflow-x-auto">
                          <div className="flex gap-1 min-w-max flex-wrap" style={{ maxWidth: '100%' }}>
                            {Object.entries(heatmapData).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => {
                              const maxCount = Math.max(...Object.values(heatmapData), 1);
                              const intensity = count === 0 ? 0 : Math.ceil((count / maxCount) * 4);
                              const bg = intensity === 0 ? 'bg-gray-200'
                                : intensity === 1 ? 'bg-green-200'
                                : intensity === 2 ? 'bg-green-300'
                                : intensity === 3 ? 'bg-green-400'
                                : 'bg-green-500';
                              const label = new Date(date + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
                              return (
                                <div key={date} title={`${label}: ${count}人打卡`}
                                  className={`w-4 h-4 rounded-sm ${bg} cursor-pointer hover:ring-1 hover:ring-[#165DFF]/50 transition-all flex-shrink-0`} />
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[10px] text-gray-400">少</span>
                            {['bg-gray-200','bg-green-200','bg-green-300','bg-green-400','bg-green-500'].map(c => (
                              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
                            ))}
                            <span className="text-[10px] text-gray-400">多</span>
                          </div>
                        </div>
                      </div>

                      {/* 成员打卡排行 */}
                      {checkinStats.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5" />打卡排行（近{checkinDays}天）
                          </p>
                          <div className="space-y-1.5">
                            {checkinStats.slice(0, 10).map((s, idx) => {
                              const name = s.profile?.full_name || s.profile?.email?.split('@')[0] || '同学';
                              return (
                                <div key={s.userId} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                                    idx === 2 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'
                                  }`}>{idx + 1}</span>
                                  <Avatar className="w-6 h-6 shrink-0">
                                    <AvatarImage src={s.profile?.avatar_url ?? undefined} />
                                    <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-[10px]">
                                      {getInitials(s.profile?.full_name, s.profile?.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="flex-1 min-w-0 text-xs font-medium text-gray-700 truncate">{name}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {s.streak > 0 && (
                                      <span className="flex items-center gap-0.5 text-[11px] text-orange-500">
                                        <Flame className="w-3 h-3" />{s.streak}天
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-500 font-semibold">{s.total}次</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* 任务面板 */}
              {detailTab === 'tasks' && (
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-4 space-y-4">
                    {/* 组长发布任务按钮 */}
                    {user && activeGroup.owner_id === user.id && (
                      <Button onClick={() => setTaskDialogOpen(true)}
                        className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5 h-9">
                        <Plus className="w-4 h-4" />发布任务/作业
                      </Button>
                    )}
                    {tasksLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                    ) : tasks.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>暂无任务，等待组长发布</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tasks.map(t => (
                          <div key={t.id} className="bg-gray-50 rounded-xl p-4 border border-[#E5E6EB]">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge className={`border-0 text-xs ${t.task_type === 'homework' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {t.task_type === 'homework' ? '作业' : '任务'}
                                  </Badge>
                                  <span className="font-semibold text-gray-800 text-sm text-balance">{t.title}</span>
                                </div>
                                {t.description && <p className="text-xs text-gray-500 mb-2 text-pretty">{t.description}</p>}
                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                                    {new Date(t.created_at).toLocaleDateString('zh-CN')}
                                  </span>
                                  {t.due_date && (
                                    <span className={`flex items-center gap-1 font-medium ${new Date(t.due_date) < new Date() ? 'text-red-500' : 'text-orange-500'}`}>
                                      <CalendarDays className="w-3 h-3" />截止 {new Date(t.due_date).toLocaleDateString('zh-CN')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {user && activeGroup.owner_id === user.id && (
                                <button onClick={() => handleDeleteTask(t.id)}
                                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 文件面板 */}
              {detailTab === 'files' && (
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-4 space-y-4">
                    {user && activeGroup.is_member && (
                      <div className="border-2 border-dashed border-[#165DFF]/30 rounded-xl p-4 text-center bg-[#165DFF]/5">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-[#165DFF]/50" />
                        <p className="text-sm text-gray-500 mb-2">点击上传文件（最大 20MB，有效期 7 天）</p>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                        <Button variant="outline" size="sm" disabled={uploadingFile}
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-1.5 border-[#165DFF]/30 text-[#165DFF]">
                          {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                          {uploadingFile ? '上传中…' : '选择文件'}
                        </Button>
                      </div>
                    )}
                    {filesLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                    ) : files.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>暂无文件，成员可上传共享文件</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {files.map(f => {
                          const expiresIn = Math.ceil((new Date(f.expires_at).getTime() - Date.now()) / 86400000);
                          return (
                            <div key={f.id} className="bg-white rounded-xl border border-[#E5E6EB] p-3 flex items-center gap-3">
                              <div className="w-9 h-9 bg-[#165DFF]/10 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-[#165DFF]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{f.file_name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                                  <span>{f.uploader_name}</span>
                                  {f.file_size && <span>{(f.file_size / 1024).toFixed(0)} KB</span>}
                                  <span className={`flex items-center gap-0.5 ${expiresIn <= 1 ? 'text-red-500' : 'text-orange-400'}`}>
                                    <Clock className="w-3 h-3" />还剩 {expiresIn} 天
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <a href={f.file_url} target="_blank" rel="noreferrer"
                                  className="text-xs text-[#165DFF] hover:underline px-2 py-1 rounded hover:bg-[#165DFF]/5 transition-colors">
                                  下载
                                </a>
                                {user && f.uploader_id === user.id && (
                                  <button onClick={() => handleDeleteFile(f.id, f.file_url)}
                                    className="text-gray-300 hover:text-red-400 transition-colors p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 邀请面板 */}
              {detailTab === 'invite' && (
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-4 space-y-4">
                    {/* 我收到的邀请 */}
                    {pendingInvites.length > 0 && (
                      <div className="bg-[#165DFF]/5 rounded-xl p-4 border border-[#165DFF]/20">
                        <p className="text-sm font-semibold text-[#165DFF] mb-2 flex items-center gap-1.5">
                          <Bell className="w-4 h-4" />待处理邀请（{pendingInvites.length}）
                        </p>
                        <div className="space-y-2">
                          {pendingInvites.filter(i => i.group_id === activeGroup.id).map(inv => (
                            <div key={inv.id} className="flex items-center justify-between gap-2 bg-white rounded-lg p-2.5">
                              <span className="text-sm text-gray-700">有人邀请你加入本小组</span>
                              <div className="flex gap-1.5 shrink-0">
                                <Button size="sm" className="h-7 text-xs bg-[#165DFF] hover:bg-[#165DFF]/90 text-white"
                                  onClick={() => handleAcceptInvite(inv)}>接受</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => handleRejectInvite(inv.id)}>拒绝</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 组长邀请好友 */}
                    {user && activeGroup.owner_id === user.id ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-[#165DFF]" />邀请好友加入
                        </p>
                        {inviteLoading ? (
                          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                        ) : friends.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>还没有好友，先去添加好友吧</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {friends.map(friend => {
                              const alreadyInvited = invitations.some(i => i.invitee_id === friend.id && i.status !== 'rejected');
                              const alreadyMember = members.some(m => m.id === friend.id);
                              return (
                                <div key={friend.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                                  <Avatar className="w-8 h-8 shrink-0">
                                    <AvatarImage src={friend.avatar_url ?? undefined} />
                                    <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-xs">
                                      {friend.full_name?.[0] || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">{friend.full_name || friend.email?.split('@')[0]}</p>
                                    <p className="text-xs text-gray-400 truncate">{friend.email}</p>
                                  </div>
                                  {alreadyMember ? (
                                    <Badge className="bg-green-100 text-green-700 border-0 text-xs shrink-0">已在组内</Badge>
                                  ) : alreadyInvited ? (
                                    <Badge className="bg-gray-100 text-gray-500 border-0 text-xs shrink-0">已邀请</Badge>
                                  ) : (
                                    <Button size="sm" className="h-7 text-xs bg-[#165DFF] hover:bg-[#165DFF]/90 text-white shrink-0"
                                      onClick={() => handleInvite(friend.id)}>
                                      <UserPlus className="w-3 h-3 mr-1" />邀请
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>只有组长可以邀请好友加入小组</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 成员列表 tab */}
              {detailTab === 'members' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                  {members.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />暂无成员
                    </div>
                  ) : members.map(m => {
                    const isOwner = m.id === activeGroup.owner_id;
                    const isSelf = m.id === user?.id;
                    const memberRole = memberRoles[m.id];
                    const isMuted = memberRole?.is_muted ?? false;
                    const myRole = user ? memberRoles[user.id]?.role : null;
                    const canManage = user && (activeGroup.owner_id === user.id || myRole === 'owner');
                    const isFriend = friendSet.has(m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-xs">
                            {getInitials(m.full_name, m.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {m.full_name || m.email?.split('@')[0] || '用户'}
                            </span>
                            {isOwner && <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                            {isMuted && <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          </div>
                          {(m.school || m.major) && (
                            <p className="text-xs text-gray-400 truncate">{[m.school, m.major].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        {/* 操作按钮组 */}
                        {!isSelf && (
                          <div className="flex items-center gap-1 shrink-0">
                            {/* 查看资料 */}
                            <button
                              onClick={() => setViewProfile(m)}
                              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                              title="查看资料"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </button>
                            {/* 私聊 */}
                            <button
                              onClick={() => navigate(`/friends?chatWith=${m.id}`)}
                              className="p-1.5 rounded-lg hover:bg-[#165DFF]/10 text-[#165DFF]/70 hover:text-[#165DFF] transition-colors"
                              title="发私信"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            {/* 加好友 */}
                            {!isFriend && (
                              <button
                                onClick={() => handleAddFriend(m.id)}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-green-500/70 hover:text-green-600 transition-colors"
                                title="加好友"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isFriend && (
                              <span title="已是好友">
                                <UserCheck className="w-3.5 h-3.5 text-green-500 mx-1.5" />
                              </span>
                            )}
                            {/* 组长专属：禁言 / 踢出 */}
                            {canManage && !isOwner && (
                              <>
                                <button
                                  onClick={() => handleToggleMute(m.id, isMuted)}
                                  className={`p-1.5 rounded-lg transition-colors ${isMuted ? 'text-orange-500 hover:bg-orange-50' : 'text-gray-400 hover:bg-gray-200'}`}
                                  title={isMuted ? '解除禁言' : '禁言'}
                                >
                                  {isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleKickMember(m.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                                  title="踢出成员"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 公告 tab */}
              {detailTab === 'announcement' && (
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {/* 公告展示区 */}
                  {!editingAnnouncement ? (
                    <div className="space-y-3">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 min-h-[100px]">
                        {activeGroup.announcement ? (
                          <>
                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                              {activeGroup.announcement}
                            </p>
                            {activeGroup.announcement_updated_at && (
                              <p className="text-[11px] text-gray-400 mt-3">
                                更新于 {new Date(activeGroup.announcement_updated_at).toLocaleString('zh-CN')}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-16 text-gray-400">
                            <Bell className="w-6 h-6 mb-1 opacity-40" />
                            <span className="text-sm">暂无公告</span>
                          </div>
                        )}
                      </div>
                      {/* 仅组长可编辑 */}
                      {user && activeGroup.owner_id === user.id && (
                        <Button
                          onClick={() => { setAnnouncementDraft(activeGroup.announcement || ''); setEditingAnnouncement(true); }}
                          className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5"
                        >
                          <Bell className="w-4 h-4" />
                          {activeGroup.announcement ? '修改公告' : '发布公告'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        value={announcementDraft}
                        onChange={e => setAnnouncementDraft(e.target.value)}
                        placeholder="输入小组公告内容，所有成员可见…"
                        rows={6}
                        maxLength={500}
                        className="resize-none text-sm"
                      />
                      <p className="text-right text-xs text-gray-400">{announcementDraft.length}/500</p>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1"
                          onClick={() => setEditingAnnouncement(false)}>
                          取消
                        </Button>
                        <Button className="flex-1 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5"
                          onClick={handleSaveAnnouncement}>
                          <Bell className="w-4 h-4" />保存公告
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 发布任务弹窗 */}
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
                  <DialogHeader><DialogTitle>发布任务/作业</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateTask} className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">类型</label>
                      <Select value={taskForm.task_type} onValueChange={v => setTaskForm(f => ({ ...f, task_type: v as 'task' | 'homework' }))}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="task">任务</SelectItem>
                          <SelectItem value="homework">作业</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">标题 <span className="text-red-400">*</span></label>
                      <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="任务/作业标题" maxLength={80} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">详情描述</label>
                      <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="详细说明要求…" rows={3} maxLength={500} className="resize-none text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">截止时间</label>
                      <Input type="datetime-local" value={taskForm.due_date}
                        onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} className="h-10" />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>取消</Button>
                      <Button type="submit" disabled={creatingTask} className="bg-[#165DFF] hover:bg-[#165DFF]/90 text-white gap-1.5">
                        {creatingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                        发布
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center text-gray-300 bg-white rounded-2xl border border-[#E5E6EB]">
              <div className="text-center">
                <Users className="w-14 h-14 mx-auto mb-3 text-gray-100" />
                <p className="text-base text-gray-400">选择一个小组查看讨论</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 创建小组弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>创建学习小组</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">小组名称 <span className="text-red-400">*</span></label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="如：高数备考组、英语口语练习"
                maxLength={30}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">学科方向</label>
              <Input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="如：数学、英语、计算机"
                maxLength={20}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">简介</label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="介绍一下小组目标和学习计划…"
                rows={3}
                maxLength={200}
                className="resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">最大成员数</label>
              <Input
                type="number"
                value={form.max_members}
                onChange={e => setForm(f => ({ ...f, max_members: e.target.value }))}
                min={2} max={50}
                className="h-10"
              />
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="submit" disabled={creating} className="bg-[#165DFF] hover:bg-[#165DFF]/90 text-white">
                {creating ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />创建中…</> : '创建小组'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LoginPromptModal open={loginPrompt} onClose={() => setLoginPrompt(false)} />

      {/* 查看成员资料弹窗 */}
      <Dialog open={!!viewProfile} onOpenChange={o => { if (!o) setViewProfile(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>成员资料</DialogTitle>
          </DialogHeader>
          {viewProfile && (
            <div className="flex flex-col items-center gap-4 py-2">
              <Avatar className="w-16 h-16">
                <AvatarImage src={viewProfile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-[#165DFF]/10 text-[#165DFF] text-xl font-semibold">
                  {viewProfile.full_name?.[0] || viewProfile.email?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">{viewProfile.full_name || '未设置昵称'}</p>
                <p className="text-sm text-gray-400 mt-0.5">{viewProfile.email}</p>
              </div>
              <div className="w-full space-y-2 text-sm">
                {viewProfile.school && (
                  <div className="flex justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">学校</span>
                    <span className="text-gray-800 font-medium">{viewProfile.school}</span>
                  </div>
                )}
                {viewProfile.major && (
                  <div className="flex justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">专业</span>
                    <span className="text-gray-800 font-medium">{viewProfile.major}</span>
                  </div>
                )}
                {viewProfile.grade && (
                  <div className="flex justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">年级</span>
                    <span className="text-gray-800 font-medium">{viewProfile.grade}</span>
                  </div>
                )}
                {!viewProfile.school && !viewProfile.major && !viewProfile.grade && (
                  <p className="text-center text-gray-400 py-2">该用户暂未填写资料</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
