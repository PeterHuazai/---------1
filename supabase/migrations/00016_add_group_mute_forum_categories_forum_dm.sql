
-- 1. 小组成员禁言字段
ALTER TABLE group_members ADD COLUMN is_muted boolean NOT NULL DEFAULT false;

-- 2. 论坛板块管理表（admin 可增删，前端动态加载）
CREATE TABLE forum_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  icon_name   text NOT NULL DEFAULT 'BookOpen',
  color       text NOT NULL DEFAULT 'text-blue-600',
  description text,
  sort_order  int  NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 插入与现有代码一致的四个默认板块
INSERT INTO forum_categories (key, label, icon_name, color, description, sort_order) VALUES
  ('course',     '选课指南',   'BookOpen',       'text-blue-600',   '课程评价、选课技巧、必修选修经验分享', 1),
  ('cet',        '四六级备考', 'GraduationCap',  'text-orange-500', '备考计划、真题解析、学习资料交流',     2),
  ('postgrad',   '考研资料',   'BookMarked',     'text-purple-600', '考研经验、院校信息、复习资料分享',     3),
  ('internship', '实习分享',   'Briefcase',      'text-green-600',  '实习招聘、面试经验、职场心得',         4);

-- RLS: 所有人可读，管理员可写（通过服务角色）
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forum_categories_read" ON forum_categories FOR SELECT USING (true);
CREATE POLICY "forum_categories_admin" ON forum_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- 3. 论坛私信表
CREATE TABLE forum_direct_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_dm_sender   ON forum_direct_messages(sender_id);
CREATE INDEX forum_dm_receiver ON forum_direct_messages(receiver_id);
ALTER TABLE forum_direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forum_dm_send"    ON forum_direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "forum_dm_select"  ON forum_direct_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "forum_dm_update"  ON forum_direct_messages FOR UPDATE USING (auth.uid() = receiver_id);

-- 加入 realtime
ALTER PUBLICATION supabase_realtime ADD TABLE forum_direct_messages;
