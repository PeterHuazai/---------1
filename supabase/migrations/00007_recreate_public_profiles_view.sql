
-- 重建公开用户信息视图（好友搜索用，去掉敏感字段）
DROP VIEW IF EXISTS public_profiles;

CREATE VIEW public_profiles AS
  SELECT id, full_name, email, avatar_url, school, major, grade
  FROM profiles;

GRANT SELECT ON public_profiles TO authenticated;
