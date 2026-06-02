
-- 更新 is_admin() 函数，superadmin 也算 admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
$$;

-- 辅助函数：是否超级管理员
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
$$;

-- ══════════════════════════════════════════
-- 论坛帖子
-- ══════════════════════════════════════════
CREATE TABLE forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('course','cet','postgrad','internship')),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  views integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON forum_posts(category, created_at DESC);
CREATE INDEX ON forum_replies(post_id, created_at);

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_select" ON forum_posts FOR SELECT USING (NOT is_deleted);
CREATE POLICY "fp_insert" ON forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "fp_update_own" ON forum_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "fp_admin" ON forum_posts FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "fr_select" ON forum_replies FOR SELECT USING (NOT is_deleted);
CREATE POLICY "fr_insert" ON forum_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "fr_update_own" ON forum_replies FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "fr_admin" ON forum_replies FOR ALL TO authenticated USING (is_admin());

-- ══════════════════════════════════════════
-- 小组任务
-- ══════════════════════════════════════════
CREATE TABLE group_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  due_date timestamptz,
  task_type text NOT NULL DEFAULT 'task' CHECK (task_type IN ('task','homework')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 小组文件分享
CREATE TABLE group_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 小组邀请
CREATE TABLE group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id),
  invitee_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, invitee_id)
);

CREATE INDEX ON group_tasks(group_id, created_at DESC);
CREATE INDEX ON group_files(group_id, expires_at);
CREATE INDEX ON group_invitations(invitee_id, status);

ALTER TABLE group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gt_select" ON group_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_tasks.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "gt_insert" ON group_tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_tasks.group_id AND gm.user_id = auth.uid() AND gm.role = 'leader'));
CREATE POLICY "gt_delete" ON group_tasks FOR DELETE TO authenticated USING (creator_id = auth.uid());

CREATE POLICY "gf_select" ON group_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_files.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "gf_insert" ON group_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_files.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "gf_delete" ON group_files FOR DELETE TO authenticated USING (uploader_id = auth.uid());

CREATE POLICY "gi_select" ON group_invitations FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());
CREATE POLICY "gi_insert" ON group_invitations FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND EXISTS (
    SELECT 1 FROM group_members gm WHERE gm.group_id = group_invitations.group_id AND gm.user_id = auth.uid() AND gm.role = 'leader'
  ));
CREATE POLICY "gi_update" ON group_invitations FOR UPDATE TO authenticated USING (invitee_id = auth.uid());

-- ══════════════════════════════════════════
-- 管理员操作日志
-- ══════════════════════════════════════════
CREATE TABLE admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON admin_logs(admin_id, created_at DESC);
CREATE INDEX ON admin_logs(created_at DESC);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_select" ON admin_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "al_insert" ON admin_logs FOR INSERT TO authenticated WITH CHECK (is_admin());

-- ══════════════════════════════════════════
-- 用户封禁
-- ══════════════════════════════════════════
CREATE TABLE user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  banned_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  ban_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ub_admin_all" ON user_bans FOR ALL TO authenticated USING (is_admin());

-- ══════════════════════════════════════════
-- profiles 新增字段
-- ══════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_until timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- ══════════════════════════════════════════
-- 文件存储桶
-- ══════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('group-files', 'group-files', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "group_files_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'group-files');
CREATE POLICY "group_files_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'group-files');
CREATE POLICY "group_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'group-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ══════════════════════════════════════════
-- Realtime
-- ══════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE forum_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE forum_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE group_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE group_files;
ALTER PUBLICATION supabase_realtime ADD TABLE group_invitations;
