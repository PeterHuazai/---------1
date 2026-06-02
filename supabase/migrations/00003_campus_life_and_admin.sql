
-- ============================================================
-- 校园生活功能 + 管理员后台数据表
-- ============================================================

-- 1. 空教室表
CREATE TABLE classrooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building    text NOT NULL,              -- 楼栋名
  room_name   text NOT NULL,              -- 教室名（如 A201）
  floor       int  NOT NULL DEFAULT 1,
  capacity    int  NOT NULL DEFAULT 50,   -- 容纳人数
  created_at  timestamptz DEFAULT now()
);

-- 空教室空闲时段表
CREATE TABLE classroom_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  day_of_week  int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=周一
  start_time   time NOT NULL,
  end_time     time NOT NULL
);

-- 2. 社团活动表
CREATE TABLE club_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  club_name     text NOT NULL,
  description   text,
  location      text,
  start_time    timestamptz NOT NULL,
  end_time      timestamptz,
  signup_deadline timestamptz,
  poster_url    text,
  published_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

-- 活动报名表
CREATE TABLE activity_signups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES club_activities(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

-- 3. 二手交易表
CREATE TABLE second_hand (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL DEFAULT 0,
  category     text NOT NULL DEFAULT '其他',  -- 书籍/电子/生活/服饰/其他
  image_url    text,
  contact      text NOT NULL,
  status       text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold')),
  is_deleted   boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- 4. 失物招领表
CREATE TABLE lost_found (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type    text NOT NULL CHECK (post_type IN ('lost','found')),  -- lost=失物 found=招领
  title        text NOT NULL,
  description  text,
  location     text,
  contact      text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  is_deleted   boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- 5. 校园资讯表
CREATE TABLE campus_news (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  category     text NOT NULL DEFAULT '通知',  -- 通知/新闻/公告
  views        int  NOT NULL DEFAULT 0,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 6. 邮件日志表（Streamlit 邮件功能使用）
CREATE TABLE IF NOT EXISTS email_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email   text NOT NULL,
  subject    text NOT NULL,
  status     text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed')),
  error_msg  text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS 策略
-- ============================================================

-- 空教室：完全公开只读
ALTER TABLE classrooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开查询空教室" ON classrooms     FOR SELECT USING (true);
CREATE POLICY "公开查询时段"   ON classroom_slots FOR SELECT USING (true);

-- 社团活动：公开浏览，登录用户可发布
ALTER TABLE club_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开浏览活动"   ON club_activities FOR SELECT USING (true);
CREATE POLICY "登录用户发布活动" ON club_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "发布者编辑活动"  ON club_activities FOR UPDATE TO authenticated USING (published_by = auth.uid());
CREATE POLICY "发布者删除活动"  ON club_activities FOR DELETE TO authenticated USING (published_by = auth.uid());

-- 活动报名：登录用户可报名/查看自己的报名
ALTER TABLE activity_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "查看报名"     ON activity_signups FOR SELECT USING (true);
CREATE POLICY "登录用户报名" ON activity_signups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "取消报名"     ON activity_signups FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 二手交易：公开浏览，登录用户发布，自己可修改
ALTER TABLE second_hand ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开浏览二手"     ON second_hand FOR SELECT USING (is_deleted = false);
CREATE POLICY "登录用户发布二手" ON second_hand FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "自己修改二手"     ON second_hand FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 失物招领：公开浏览，登录用户发布，自己可修改
ALTER TABLE lost_found ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开浏览失物"     ON lost_found FOR SELECT USING (is_deleted = false);
CREATE POLICY "登录用户发布失物" ON lost_found FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "自己修改失物"     ON lost_found FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 校园资讯：完全公开只读（管理员通过 service_role 写入）
ALTER TABLE campus_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开浏览资讯" ON campus_news FOR SELECT USING (true);

-- 邮件日志：用户只能看自己的
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "查看自己邮件日志" ON email_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "插入邮件日志"     ON email_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
