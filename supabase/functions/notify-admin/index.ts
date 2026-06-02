import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'npm:emailjs@4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { message_id, sender_name, subject, content } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 写入管理员日志
    await supabase.from('admin_logs').insert({
      admin_id: '618367b3-5077-41fb-b2a0-a855d3f5ecbc',
      action: 'contact_message_received',
      target_type: 'contact_message',
      target_id: String(message_id),
      details: { sender: sender_name, subject, preview: String(content || '').slice(0, 100) },
    });

    const emailUser = Deno.env.get('EMAIL_USER') || '';
    const emailPass = Deno.env.get('EMAIL_PASS') || '';
    // 管理员收件邮箱（固定为 QQ 邮箱）
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || '3520937281@qq.com';

    if (!emailUser || !emailPass) {
      console.log(`[notify-admin] 邮箱未配置，跳过邮件发送。消息ID: ${message_id}`);
      return json({ success: true, note: '邮箱未配置，邮件未发送' });
    }

    const htmlContent = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#165DFF;margin-bottom:16px">📬 收到新用户消息</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:8px;background:#f5f7fa;border-radius:4px;width:80px;font-weight:600;color:#555">发件人</td>
        <td style="padding:8px;color:#333">${sender_name || '匿名用户'}</td></tr>
    <tr><td style="padding:8px;font-weight:600;color:#555">主题</td>
        <td style="padding:8px;color:#333">${subject || '无主题'}</td></tr>
    <tr><td style="padding:8px;background:#f5f7fa;font-weight:600;color:#555;vertical-align:top">内容</td>
        <td style="padding:8px;color:#333;white-space:pre-wrap">${content || '（无内容）'}</td></tr>
    <tr><td style="padding:8px;font-weight:600;color:#555">消息ID</td>
        <td style="padding:8px;color:#888;font-size:12px">${message_id}</td></tr>
  </table>
  <p style="color:#888;font-size:12px">时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
  <p style="color:#888;font-size:12px">请登录管理后台查看并回复 —— 大学生学习管理平台</p>
</div>`.trim();

    // 直接通过 163 SMTP 发送邮件到管理员收件箱
    try {
      const client = new SMTPClient({
        user: emailUser,
        password: emailPass,
        host: 'smtp.163.com',
        ssl: true,
        port: 465,
        timeout: 10000,
      });

      await client.sendAsync({
        from: `学习平台通知 <${emailUser}>`,
        to: adminEmail,
        subject: `[管理员通知] 新用户消息：${subject || '无主题'}`,
        attachment: [{ data: htmlContent, alternative: true }],
      });

      console.log(`[notify-admin] 邮件已发送至管理员 ${adminEmail}`);
      return json({ success: true, message: `通知已发送至 ${adminEmail}` });
    } catch (mailErr) {
      const errMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error('[notify-admin] SMTP发送失败:', errMsg);
      // 返回 500 让客户端能捕获错误
      return json({ success: false, error: 'SMTP发送失败: ' + errMsg }, 500);
    }
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
