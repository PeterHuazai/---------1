
-- 管理员可对校园资讯进行增删改
CREATE POLICY "管理员发布资讯" ON campus_news
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "管理员修改资讯" ON campus_news
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "管理员删除资讯" ON campus_news
  FOR DELETE TO authenticated USING (is_admin());
