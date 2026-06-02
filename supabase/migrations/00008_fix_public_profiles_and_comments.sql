
-- 1. 修复 public_profiles：使用 SECURITY DEFINER 函数绕过 RLS，允许已登录用户搜索所有用户
DROP VIEW IF EXISTS public_profiles;

CREATE OR REPLACE FUNCTION get_public_profiles(search_text text DEFAULT '')
RETURNS TABLE (
  id uuid, full_name text, email text, avatar_url text, school text, major text, grade text
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.avatar_url, p.school, p.major, p.grade
  FROM profiles p
  WHERE
    auth.uid() IS NOT NULL
    AND p.id != auth.uid()
    AND (
      search_text = ''
      OR p.full_name ILIKE '%' || search_text || '%'
      OR p.email ILIKE '%' || search_text || '%'
      OR p.school ILIKE '%' || search_text || '%'
      OR p.major ILIKE '%' || search_text || '%'
    )
  LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION get_public_profiles(text) TO authenticated;

-- 重建 view（仍保留供 homepage count 使用）
CREATE VIEW public_profiles AS
  SELECT id, full_name, email, avatar_url, school, major, grade FROM profiles;

-- 给 view 加 security definer（PG15+）
ALTER VIEW public_profiles SET (security_invoker = false);

GRANT SELECT ON public_profiles TO authenticated;

-- 允许已登录用户查看所有 profiles（仅用于 public_profiles 视图的兼容性）
CREATE POLICY "已登录用户可浏览公开资料"
  ON profiles FOR SELECT TO authenticated
  USING (true);

-- 2. 创建评论表
CREATE TABLE post_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type   text NOT NULL CHECK (post_type IN ('secondhand', 'lostfound')),
  post_id     uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_comments_post ON post_comments(post_type, post_id);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- 公开可读
CREATE POLICY "所有人可查看评论" ON post_comments
  FOR SELECT USING (true);

-- 已登录用户可发评论
CREATE POLICY "已登录用户可发评论" ON post_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 本人可删除自己的评论
CREATE POLICY "本人可删除评论" ON post_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 开启 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
