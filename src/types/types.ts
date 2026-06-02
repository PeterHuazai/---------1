// ── 校园生活相关类型 ────────────────────────────────────────

export interface Classroom {
  id: string;
  building: string;
  room_name: string;
  floor: number;
  capacity: number;
  slots?: ClassroomSlot[];
}

export interface ClassroomSlot {
  id: string;
  classroom_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface ClubActivity {
  id: string;
  title: string;
  club_name: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  signup_deadline: string | null;
  poster_url: string | null;
  published_by: string | null;
  created_at: string;
  signup_count?: number;
  is_signed_up?: boolean;
}

export interface SecondHand {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  contact: string;
  status: 'available' | 'sold';
  is_deleted: boolean;
  created_at: string;
  seller_name?: string;
}

export interface LostFound {
  id: string;
  user_id: string;
  post_type: 'lost' | 'found';
  title: string;
  description: string | null;
  location: string | null;
  contact: string;
  status: 'open' | 'closed';
  is_deleted: boolean;
  created_at: string;
  poster_name?: string;
}

export interface CampusNews {
  id: string;
  title: string;
  content: string;
  category: string;
  views: number;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── 原有类型 ────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'user' | 'admin' | 'superadmin';
  full_name: string | null;
  school: string | null;
  major: string | null;
  grade: string | null;
  avatar_url: string | null;
  theme_preference: string | null;
  reminder_time_start: string | null;
  reminder_time_end: string | null;
  dashboard_order: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  teacher: string | null;
  credits: number | null;
  course_type: string | null;
  color: string | null;
  start_week: number | null;
  end_week: number | null;
  reminder_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  course_id: string | null;
  course_name?: string;
  name: string;
  type: string;
  due_date: string;
  submit_method: string | null;
  weight: number | null;
  notes: string | null;
  status: string;
  reminder_3d: boolean;
  reminder_1d: boolean;
  reminder_1h: boolean;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  user_id: string;
  course_id: string | null;
  course_name?: string;
  chapter: string | null;
  name: string;
  file_type: string;
  file_url: string | null;
  file_size: number | null;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  period: string;
  target_value: number;
  unit: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  goal_id: string;
  user_id: string;
  checkin_date: string;
  notes: string | null;
  duration_minutes: number;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_type: 'secondhand' | 'lostfound';
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // 附加（join）
  author_name?: string | null;
  author_avatar?: string | null;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  // 附加
  profile?: PublicProfile;
}

export interface PublicProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  school: string | null;
  major: string | null;
  grade: string | null;
  friend_count?: number;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

// ── 论坛 ──────────────────────────────────────────
export type ForumCategory = 'course' | 'cet' | 'postgrad' | 'internship';

export interface ForumPost {
  id: string;
  category: ForumCategory;
  title: string;
  content: string;
  author_id: string;
  views: number;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ForumReply {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
}

// ── 小组任务/文件/邀请 ─────────────────────────────
export interface GroupTask {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  task_type: 'task' | 'homework';
  created_at: string;
}

export interface GroupFile {
  id: string;
  group_id: string;
  uploader_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  expires_at: string;
  created_at: string;
  uploader_name?: string;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

// ── 管理员日志 ─────────────────────────────────────
export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_name?: string;
}

// ── 封禁 ──────────────────────────────────────────
export interface UserBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string | null;
  ban_until: string | null;
  created_at: string;
}
