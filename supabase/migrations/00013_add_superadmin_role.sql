
-- 添加 superadmin 角色到枚举
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'superadmin';
