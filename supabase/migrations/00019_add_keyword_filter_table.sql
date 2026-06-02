-- 关键词过滤表
CREATE TABLE keyword_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  list_type text NOT NULL CHECK (list_type IN ('blacklist', 'whitelist')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (keyword, list_type)
);

-- 仅管理员可管理关键词
ALTER TABLE keyword_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员可读取关键词" ON keyword_filters
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "管理员可插入关键词" ON keyword_filters
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "管理员可删除关键词" ON keyword_filters
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 允许已登录用户读取黑名单（用于客户端校验）
CREATE POLICY "登录用户可读取黑名单" ON keyword_filters
  FOR SELECT TO authenticated
  USING (list_type = 'blacklist');