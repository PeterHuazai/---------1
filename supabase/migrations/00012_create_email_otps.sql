
CREATE TABLE email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON email_otps (email, expires_at);

-- 自动清理过期记录（可选触发策略，用于按需清理）
-- RLS: Edge Function 使用 service_role，无需 RLS
ALTER TABLE email_otps ENABLE ROW LEVEL SECURITY;
-- 禁止客户端直接读写
CREATE POLICY "deny_all_email_otps" ON email_otps FOR ALL TO anon, authenticated USING (false);
