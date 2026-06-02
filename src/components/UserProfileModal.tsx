import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, UserPlus, UserCheck, School, BookOpen, GraduationCap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PublicProfile } from '@/types/types';

interface UserProfileModalProps {
  userId: string | null;
  onClose: () => void;
  onRequireLogin?: () => void;
}

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.slice(0, 2);
  if (email) return email[0].toUpperCase();
  return '?';
}

export default function UserProfileModal({ userId, onClose, onRequireLogin }: UserProfileModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'accepted'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isSelf = user?.id === userId;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setProfile(null);
    setFriendStatus('none');

    // 获取公开资料
    supabase.from('public_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });

    // 检查好友关系（仅登录用户）
    if (user && user.id !== userId) {
      supabase.from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setFriendshipId(data.id);
            if (data.status === 'accepted') setFriendStatus('accepted');
            else setFriendStatus('pending_sent');
          }
        });
    }
  }, [userId, user]);

  const handleAddFriend = async () => {
    if (!user) { onRequireLogin?.(); return; }
    setActionLoading(true);
    const { error } = await supabase.from('friendships').insert({
      user_id: user.id, friend_id: userId, status: 'pending',
    });
    setActionLoading(false);
    if (error) { toast.error('发送失败：' + error.message); return; }
    toast.success('好友申请已发送');
    setFriendStatus('pending_sent');
  };

  const handleChat = () => {
    if (!user) { onRequireLogin?.(); return; }
    onClose();
    navigate(`/friends?chatWith=${userId}`);
  };

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || '同学';

  return (
    <Dialog open={!!userId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>用户资料</DialogTitle>
        </DialogHeader>

        {/* 顶部装饰 */}
        <div className="h-20 bg-gradient-to-r from-[#165DFF] to-[#36a3ff] relative">
          <Avatar className="w-16 h-16 absolute -bottom-8 left-6 ring-4 ring-white">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-[#165DFF] text-white text-lg font-bold">
              {getInitials(profile?.full_name, profile?.email)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="pt-12 pb-5 px-6">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 text-balance">{displayName}</h2>
              {isSelf && <Badge className="mt-1 text-[10px] bg-[#165DFF]/10 text-[#165DFF] border-0">这是你</Badge>}

              <div className="mt-3 space-y-1.5">
                {profile?.school && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <School className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>{profile.school}</span>
                  </div>
                )}
                {profile?.major && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <BookOpen className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>{profile.major}</span>
                  </div>
                )}
                {profile?.grade && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <GraduationCap className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>{profile.grade}</span>
                  </div>
                )}
                {!profile?.school && !profile?.major && !profile?.grade && (
                  <p className="text-sm text-gray-400">该用户暂未完善个人信息</p>
                )}
              </div>

              {/* 操作按钮（对他人显示） */}
              {!isSelf && user && (
                <div className="mt-4 flex gap-2">
                  {friendStatus === 'none' && (
                    <Button
                      onClick={handleAddFriend}
                      disabled={actionLoading}
                      className="flex-1 h-9 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white text-sm gap-1.5"
                    >
                      {actionLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <UserPlus className="w-3.5 h-3.5" />
                      }
                      加好友
                    </Button>
                  )}
                  {friendStatus === 'pending_sent' && (
                    <div className="flex-1 h-9 text-sm gap-1.5 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 font-medium text-muted-foreground opacity-50 cursor-not-allowed select-none">
                      <UserCheck className="w-3.5 h-3.5 mr-1" />已申请
                    </div>
                  )}
                  {friendStatus === 'accepted' && (
                    <div className="flex-1 h-9 text-sm gap-1.5 inline-flex items-center justify-center rounded-md border border-green-200 bg-background px-3 font-medium text-green-600 opacity-70 cursor-not-allowed select-none">
                      <UserCheck className="w-3.5 h-3.5 mr-1" />已是好友
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleChat}
                    className="flex-1 h-9 text-sm gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />私聊
                  </Button>
                </div>
              )}

              {/* 未登录时提示 */}
              {!user && !isSelf && (
                <Button
                  onClick={() => { onRequireLogin?.(); }}
                  className="mt-4 w-full h-9 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white text-sm"
                >
                  登录后加好友 / 私聊
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
