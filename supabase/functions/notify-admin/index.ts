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

    // 写入管理员操作日志（非阻塞）
    supabase.from('admin_logs').insert({
      admin_id: '618367b3-5077-41fb-b2a0-a855d3f5ecbc',
      action: 'contact_message_received',
      target_type: 'contact_message',
      target_id: String(message_id),
      details: { sender: sender_name, subject, preview: String(content || '').slice(0, 100) },
    }).then(({ error }) => {
      if (error) console.warn('[notify-admin] 写入日志失败:', error.message);
    });

    const emailUser = Deno.env.get('EMAIL_USER') || '';
    const emailPass = Deno.env.get('EMAIL_PASS') || '';
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || '3520937281@qq.com';

    if (!emailUser || !emailPass) {
      console.warn('[notify-admin] EMAIL_USER / EMAIL_PASS 未配置，跳过邮件发送');
      return json({ success: true, note: '邮箱未配置，邮件未发送' });
    }

    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>新用户消息</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,'Microsoft YaHei',sans-serif">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#165DFF;padding:24px 28px">
      <h2 style="margin:0;color:#fff;font-size:20px;font-weight:600">📬 新用户消息</h2>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">大学生学习管理平台 · 管理员通知</p>
    </div>
    <div style="padding:28px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr style="background:#f8f9fc">
          <td style="padding:10px 14px;font-weight:600;color:#555;width:80px;border-radius:4px 0 0 4px;font-size:13px">发件人</td>
          <td style="padding:10px 14px;color:#333;font-size:13px">${sender_name || '匿名用户'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#555;font-size:13px">主题</td>
          <td style="padding:10px 14px;color:#333;font-size:13px">${subject || '无主题'}</td>
        </tr>
        <tr style="background:#f8f9fc">
          <td style="padding:10px 14px;font-weight:600;color:#555;vertical-align:top;font-size:13px">内容</td>
          <td style="padding:10px 14px;color:#333;white-space:pre-wrap;font-size:13px;line-height:1.6">${content || '（无内容）'}</td>
        </tr>
      </table>
      <div style="background:#fff8f0;border:1px solid #fde7c7;border-radius:8px;padding:12px 16px;margin-bottom:16px">
        <p style="margin:0;color:#e6772e;font-size:12px;font-weight:600">⚡ 消息ID：${message_id}</p>
        <p style="margin:4px 0 0;color:#999;font-size:12px">收到时间：${now}</p>
      </div>
      <a href="https://app-bvo9cuao8lq9.miaoda.ai/admin" style="display:inline-block;background:#165DFF;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">登录后台查看并回复 →</a>
    </div>
    <div style="background:#f5f7fa;padding:14px 28px;text-align:center">
      <p style="margin:0;color:#bbb;font-size:11px">此邮件由系统自动发送，请勿直接回复 · 大学生学习管理平台</p>
    </div>
  </div>
</body>
</html>`;

    // 通过 163 SMTP 发送
    try {
      console.log(`[notify-admin] 开始发送邮件 → ${adminEmail}，使用账号 ${emailUser}`);

      const client = new SMTPClient({
        user: emailUser,
        password: emailPass,
        host: 'smtp.163.com',
        ssl: true,
        port: 465,
        timeout: 15000,
      });

      await client.sendAsync({
        from: `学习平台通知 <${emailUser}>`,
        to: adminEmail,
        subject: `[管理员通知] 新用户消息：${subject || '无主题'}`,
        attachment: [
          { data: htmlContent, alternative: true },
          { data: `发件人: ${sender_name || '匿名用户'}\n主题: ${subject || '无主题'}\n内容:\n${content || '（无内容）'}\n\n时间: ${now}`, alternative: false },
        ],
      });

      console.log(`[notify-admin] ✅ 邮件发送成功 → ${adminEmail}`);
      return json({ success: true, message: `通知已发送至 ${adminEmail}` });

    } catch (mailErr) {
      const errMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error('[notify-admin] ❌ SMTP发送失败:', errMsg);
      // 邮件失败不影响消息记录，返回部分成功
      return json({ success: false, error: `邮件发送失败: ${errMsg}`, message_saved: true }, 200);
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[notify-admin] 未知错误:', errMsg);
    return json({ error: errMsg }, 500);
  }
});
