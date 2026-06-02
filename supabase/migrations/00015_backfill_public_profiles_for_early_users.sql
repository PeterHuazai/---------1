
INSERT INTO public_profiles (id, full_name, email, avatar_url, school, major, grade)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  u.email,
  u.raw_user_meta_data->>'avatar_url',
  NULL,
  NULL,
  NULL
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public_profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
