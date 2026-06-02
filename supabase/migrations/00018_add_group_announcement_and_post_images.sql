-- 小组公告字段
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS announcement text;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS announcement_updated_at timestamptz;

-- 帖子图片（支持多图，存 JSON 数组）
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]'::jsonb;

-- 论坛图片存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('forum-images', 'forum-images', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 存储桶策略：已登录用户可上传
CREATE POLICY "登录用户可上传论坛图片" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'forum-images');

CREATE POLICY "所有人可查看论坛图片" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'forum-images');