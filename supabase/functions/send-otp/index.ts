import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: '邮箱不能为空' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailReg.test(email)) {
      return new Response(JSON.stringify({ error: '邮箱格式不正确' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 清理该邮箱旧的未使用 OTP
    await supabase.from('email_otps').delete()
      .eq('email', email).eq('used', false);

    // 生成 6 位随机验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // 写入数据库
    const { error: dbError } = await supabase.from('email_otps').insert({
      email,
      code,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (dbError) throw dbError;

    // 尝试通过 send-email 发送真实邮件
    const emailUser = Deno.env.get('EMAIL_USER');
    const emailPass = Deno.env.get('EMAIL_PASS');
    let emailSent = false;

    if (emailUser && emailPass) {
      try {
        const sendEmailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;
        const html = `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e6eb; border-radius: 12px;">
            <h2 style="color: #165dff; margin-bottom: 8px;">大学生学习管理平台</h2>
            <p style="color: #4e5969; margin-bottom: 24px;">您正在注册账号，请使用以下验证码完成邮箱验证：</p>
            <div style="background: #f2f7ff; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: bold; color: #165dff; letter-spacing: 8px;">${code}</span>
            </div>
            <p style="color: #86909c; font-size: 13px;">验证码有效期 <strong>10 分钟</strong>，请勿泄露给他人。</p>
            <p style="color: #c9cdd4; font-size: 12px; margin-top: 16px;">如非本人操作，请忽略此邮件。</p>
          </div>`;

        const resp = await fetch(sendEmailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ to: email, subject: '【大学生学习平台】邮箱验证码', html }),
        });

        if (resp.ok) {
          emailSent = true;
        } else {
          const errText = await resp.text();
          console.warn('[send-otp] send-email 返回错误:', errText);
        }
      } catch (sendErr) {
        console.warn('[send-otp] 调用 send-email 失败:', String(sendErr));
      }
    }

    // 返回结果：邮件已发送则不返回 debug_code；否则降级返回 code 方便测试
    return new Response(JSON.stringify({
      success: true,
      message: emailSent
        ? '验证码已发送至您的邮箱，请查收（有效期10分钟）'
        : '验证码已生成（邮件服务未配置，调试模式）',
      ...(emailSent ? {} : { debug_code: code }),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
