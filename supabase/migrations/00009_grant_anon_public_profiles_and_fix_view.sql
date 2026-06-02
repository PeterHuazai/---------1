
-- 1. 允许匿名用户读取 public_profiles（评论区显示发帖人昵称）
GRANT SELECT ON public_profiles TO anon;

-- 2. 评论表也确认 anon 可读
GRANT SELECT ON post_comments TO anon;

-- 3. get_public_profiles 函数对匿名用户不暴露（搜索好友必须登录），保持原样
-- 只需让 CommentsSection 能读 public_profiles 即可

-- 4. 修复 profiles RLS：允许匿名用户通过 public_profiles view 查询（view 本身不加 RLS，profiles 加 anon 策略）
CREATE POLICY "匿名用户可浏览公开资料字段"
  ON profiles FOR SELECT TO anon
  USING (true);
