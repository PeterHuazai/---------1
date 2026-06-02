
-- 好友关系表
CREATE TABLE friendships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id)
);

ALTER TABLE friendships ADD CONSTRAINT no_self_friend CHECK (user_id <> friend_id);

CREATE INDEX idx_friendships_user_id   ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);

CREATE OR REPLACE FUNCTION update_friendships_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_friendships_updated_at();

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己相关的好友记录" ON friendships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "用户可发送好友请求" ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "被邀请方可更新状态" ON friendships
  FOR UPDATE TO authenticated
  USING (friend_id = auth.uid())
  WITH CHECK (friend_id = auth.uid());

CREATE POLICY "本人可删除好友关系" ON friendships
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());
