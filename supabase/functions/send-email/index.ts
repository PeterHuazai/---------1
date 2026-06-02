import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SMTPClient } from 'npm:emailjs@4';
import { corsHeaders } from '../_shared/cors.ts';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const emailUser = Deno.env.get('EMAIL_USER');
    const emailPass = Deno.env.get('EMAIL_PASS');
    const fromName = Deno.env.get('EMAIL_FROM_NAME') || '学习助手';

    if (!emailUser || !emailPass) {
      return new Response(
        JSON.stringify({ error: '邮件服务未配置，请在密钥设置中填写 EMAIL_USER 和 EMAIL_PASS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: EmailPayload = await req.json();
    const { to, subject, html } = payload;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: '收件人邮箱格式不正确' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 初始化 163 SMTP 客户端（SSL 465）
    const client = new SMTPClient({
      user: emailUser,
      password: emailPass,
      host: 'smtp.163.com',
      ssl: true,
      port: 465,
    });

    await client.sendAsync({
      from: `${fromName} <${emailUser}>`,
      to,
      subject,
      attachment: [{ data: html, alternative: true }],
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-email] 发送失败:', msg);
    return new Response(
      JSON.stringify({ error: '邮件发送失败：' + msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
