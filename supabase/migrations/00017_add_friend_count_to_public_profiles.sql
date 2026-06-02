-- 给 public_profiles 视图增加好友数量统计
CREATE OR REPLACE VIEW public_profiles_with_stats AS
SELECT
  p.id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.school,
  p.major,
  p.grade,
  COALESCE(fc.friend_count, 0)::int AS friend_count
FROM public_profiles p
LEFT JOIN (
  SELECT user_id AS uid, COUNT(*) AS friend_count
  FROM friendships
  WHERE status = 'accepted'
  GROUP BY user_id
  UNION ALL
  SELECT friend_id AS uid, COUNT(*) AS friend_count
  FROM friendships
  WHERE status = 'accepted'
  GROUP BY friend_id
) sub ON sub.uid = p.id
LEFT JOIN LATERAL (
  SELECT SUM(sub2.friend_count) AS friend_count
  FROM (
    SELECT COUNT(*) AS friend_count
    FROM friendships
    WHERE status = 'accepted' AND (user_id = p.id OR friend_id = p.id)
  ) sub2
) fc ON true;