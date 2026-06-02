
-- 管理员辅助函数：检查当前用户是否为 admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 管理员可管理校园资讯
CREATE POLICY "管理员管理校园资讯" ON campus_news
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 管理员可删除二手交易（含已删除）
CREATE POLICY "管理员管理二手交易" ON second_hand
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 管理员可删除失物招领（含已删除）
CREATE POLICY "管理员管理失物招领" ON lost_found
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 管理员可管理社团活动
CREATE POLICY "管理员管理社团活动" ON club_activities
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 管理员可管理空教室
CREATE POLICY "管理员管理空教室" ON classrooms
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "管理员管理空教室时段" ON classroom_slots
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 管理员可查看所有用户 profile
CREATE POLICY "管理员查看所有用户" ON profiles
  FOR SELECT TO authenticated USING (is_admin() OR id = auth.uid());

CREATE POLICY "管理员封禁用户" ON profiles
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
