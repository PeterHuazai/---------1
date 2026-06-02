import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types/types';
import { Bell, Trash2, CheckCheck, Clock, BookOpen, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    fetchNotifications();
    toast.success('全部已读');
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    fetchNotifications();
  };

  const typeIcon = (type: string) => {
    if (type === '上课提醒') return <BookOpen className="w-4 h-4 text-[#165DFF]" />;
    if (type === '任务提醒') return <ClipboardList className="w-4 h-4 text-[#FF7D00]" />;
    return <Bell className="w-4 h-4 text-gray-400" />;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">消息中心</h1>
            {unreadCount > 0 && (
              <Badge className="bg-[#FF7D00] text-white">{unreadCount} 未读</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4 mr-1" /> 全部已读
            </Button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E5E6EB] overflow-hidden">
          <div className="divide-y divide-[#E5E6EB]">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                onClick={() => markAsRead(n.id)}
              >
                <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</span>
                    {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[#FF7D00]" />}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{n.content}</p>
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(n.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }} className="p-1.5 rounded hover:bg-red-50 shrink-0">
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>暂无消息</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
