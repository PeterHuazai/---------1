
-- 删除旧的内联 EXISTS 策略，改用已有的 is_admin() SECURITY DEFINER 函数
-- 旧策略不包含 superadmin，且不走索引优化，此处统一修正

DROP POLICY IF EXISTS "管理员可读取关键词" ON keyword_filters;
DROP POLICY IF EXISTS "管理员可插入关键词" ON keyword_filters;
DROP POLICY IF EXISTS "管理员可删除关键词" ON keyword_filters;
DROP POLICY IF EXISTS "登录用户可读取黑名单" ON keyword_filters;

-- 管理员（含 superadmin）可读取所有关键词
CREATE POLICY "管理员可读取关键词" ON keyword_filters
  FOR SELECT TO authenticated
  USING (is_admin());

-- 登录用户可读取黑名单（用于前端提交内容时做客户端预校验）
CREATE POLICY "登录用户可读取黑名单" ON keyword_filters
  FOR SELECT TO authenticated
  USING (list_type = 'blacklist');

-- 管理员可插入关键词
CREATE POLICY "管理员可插入关键词" ON keyword_filters
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- 管理员可更新关键词（备用，如以后支持编辑）
CREATE POLICY "管理员可更新关键词" ON keyword_filters
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- 管理员可删除关键词
CREATE POLICY "管理员可删除关键词" ON keyword_filters
  FOR DELETE TO authenticated
  USING (is_admin());
