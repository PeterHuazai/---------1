
-- 小组打卡记录表
CREATE TABLE group_checkins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note        text,
  checked_at  date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id, checked_at)
);

ALTER TABLE group_checkins ENABLE ROW LEVEL SECURITY;

-- 小组成员可查看本组打卡
CREATE POLICY "members_can_view_checkins" ON group_checkins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_checkins.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- 小组成员可插入自己的打卡
CREATE POLICY "members_can_checkin" ON group_checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_checkins.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- 用户可删除自己当天的打卡
CREATE POLICY "users_can_delete_own_checkin" ON group_checkins
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND checked_at = CURRENT_DATE);

-- 加入 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE group_checkins;
