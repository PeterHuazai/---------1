
-- ─────────────────────────────────────────────────────────────
-- 1. private_messages（私聊消息）
-- ─────────────────────────────────────────────────────────────
CREATE TABLE private_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) <= 1000),
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION can_access_private_message(msg_sender_id uuid, msg_receiver_id uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT auth.uid() = msg_sender_id OR auth.uid() = msg_receiver_id;
$$;

CREATE POLICY "双方可读私聊消息"
  ON private_messages FOR SELECT TO authenticated
  USING (can_access_private_message(sender_id, receiver_id));

CREATE POLICY "发送方可插入消息"
  ON private_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "接收方可标记已读"
  ON private_messages FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;

-- ─────────────────────────────────────────────────────────────
-- 2. study_groups（小组学习）
-- ─────────────────────────────────────────────────────────────
CREATE TABLE study_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  subject      text,
  max_members  int NOT NULL DEFAULT 10,
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可浏览小组"
  ON study_groups FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "登录用户可创建小组"
  ON study_groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "组长可修改小组"
  ON study_groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "组长可删除小组"
  ON study_groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. group_members（小组成员）
-- ─────────────────────────────────────────────────────────────
CREATE TABLE group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION can_access_group_member(gid uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm WHERE gm.group_id = gid AND gm.user_id = auth.uid()
  );
$$;

CREATE POLICY "所有人可查看小组成员"
  ON group_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "登录用户可加入小组"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "本人或组长可移除成员"
  ON group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR
    EXISTS(SELECT 1 FROM study_groups sg WHERE sg.id = group_id AND sg.owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 4. group_messages（小组讨论）
-- ─────────────────────────────────────────────────────────────
CREATE TABLE group_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (char_length(content) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "小组成员可读消息"
  ON group_messages FOR SELECT TO authenticated
  USING (can_access_group_member(group_id));

CREATE POLICY "小组成员可发消息"
  ON group_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND can_access_group_member(group_id));

CREATE POLICY "本人可删除自己消息"
  ON group_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
