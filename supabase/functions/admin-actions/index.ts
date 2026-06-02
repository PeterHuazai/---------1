import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: '未授权' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // 验证调用者身份
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return json({ error: '身份验证失败' }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    const callerRole = callerProfile?.role as string;
    const isAdmin = callerRole === 'admin' || callerRole === 'superadmin';
    const isSuperAdmin = callerRole === 'superadmin';

    if (!isAdmin) return json({ error: '权限不足' }, 403);

    const body = await req.json();
    const { action } = body;

    // ── 修改用户密码 ──
    if (action === 'change_password') {
      const { target_id, new_password } = body;
      if (!target_id || !new_password) return json({ error: '参数缺失' }, 400);
      if (new_password.length < 6) return json({ error: '密码至少6位' }, 400);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(target_id, { password: new_password });
      if (error) throw error;
      await logAction(supabaseAdmin, user.id, 'change_password', 'user', target_id, { by: user.id });
      return json({ success: true });
    }

    // ── 设置用户角色（admin 只能设为 admin，superadmin 可设为任何角色）──
    if (action === 'set_role') {
      const { target_id, new_role } = body;
      if (!target_id || !new_role) return json({ error: '参数缺失' }, 400);
      const allowedRoles = isSuperAdmin ? ['user', 'admin', 'superadmin'] : ['user', 'admin'];
      if (!allowedRoles.includes(new_role)) return json({ error: '无权设置该角色' }, 403);
      const { error } = await supabaseAdmin
        .from('profiles').update({ role: new_role }).eq('id', target_id);
      if (error) throw error;
      await logAction(supabaseAdmin, user.id, 'set_role', 'user', target_id, { new_role });
      return json({ success: true });
    }

    // ── 封禁用户 ──
    if (action === 'ban_user') {
      const { target_id, reason, ban_hours } = body;
      if (!target_id) return json({ error: '参数缺失' }, 400);
      // 永久封禁仅 superadmin
      if (!ban_hours && !isSuperAdmin) return json({ error: '仅超级管理员可永久封禁' }, 403);
      const ban_until = ban_hours ? new Date(Date.now() + ban_hours * 3600000).toISOString() : null;
      await supabaseAdmin.from('user_bans').upsert({
        user_id: target_id, banned_by: user.id, reason, ban_until,
      }, { onConflict: 'user_id' });
      await supabaseAdmin.from('profiles').update({ banned_until: ban_until }).eq('id', target_id);
      await logAction(supabaseAdmin, user.id, 'ban_user', 'user', target_id, { reason, ban_until, ban_hours });
      return json({ success: true });
    }

    // ── 解封用户 ──
    if (action === 'unban_user') {
      const { target_id } = body;
      if (!target_id) return json({ error: '参数缺失' }, 400);
      await supabaseAdmin.from('user_bans').delete().eq('user_id', target_id);
      await supabaseAdmin.from('profiles').update({ banned_until: null }).eq('id', target_id);
      await logAction(supabaseAdmin, user.id, 'unban_user', 'user', target_id, {});
      return json({ success: true });
    }

    // ── 获取所有用户（含 auth 邮箱/用户名）──
    if (action === 'list_users') {
      const { page = 1, per_page = 50 } = body;
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({
        page, perPage: per_page,
      });
      const ids = authUsers.map((u) => u.id);
      const { data: profiles } = await supabaseAdmin
        .from('profiles').select('*').in('id', ids);
      const { data: bans } = await supabaseAdmin
        .from('user_bans').select('user_id, ban_until, reason').in('user_id', ids);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      const banMap = Object.fromEntries((bans || []).map((b) => [b.user_id, b]));
      const result = authUsers.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.raw_user_meta_data?.username || u.email?.split('@')[0],
        created_at: u.created_at,
        profile: profileMap[u.id] || null,
        ban: banMap[u.id] || null,
      }));
      return json({ success: true, users: result });
    }

    // ── 注销用户（仅 superadmin）──
    if (action === 'delete_user') {
      if (!isSuperAdmin) return json({ error: '仅超级管理员可注销用户' }, 403);
      const { target_id } = body;
      if (!target_id) return json({ error: '参数缺失' }, 400);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(target_id);
      if (error) throw error;
      await logAction(supabaseAdmin, user.id, 'delete_user', 'user', target_id, { by: user.id });
      return json({ success: true });
    }

    return json({ error: '未知操作' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

async function logAction(
  supabase: ReturnType<typeof createClient>,
  adminId: string, action: string,
  targetType: string, targetId: string,
  details: Record<string, unknown>,
) {
  await supabase.from('admin_logs').insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, details });
}
