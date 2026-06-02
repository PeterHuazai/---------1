import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import {
  BookOpen, Eye, EyeOff, ShieldCheck, User, ArrowLeft,
  Mail, RefreshCw, CheckCircle2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

type LoginMode = 'user' | 'admin';
// 注册步骤：1=填写信息+人机验证, 2=邮箱OTP验证, 3=完成
type RegStep = 1 | 2;

// ── 数学人机验证 ─────────────────────────────────────────────
function genChallenge() {
  const ops = ['+', '-', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 10) + 1;
  const b = op === '-' ? Math.floor(Math.random() * a) + 1 : Math.floor(Math.random() * 9) + 1;
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { question: `${a} ${op} ${b} = ?`, answer };
}

interface CaptchaProps {
  onVerified: (ok: boolean) => void;
  reset?: number; // 每次 reset 变化时重新生成
}

function MathCaptcha({ onVerified, reset }: CaptchaProps) {
  const [challenge, setChallenge] = useState(genChallenge);
  const [input, setInput] = useState('');
  const [verified, setVerified] = useState(false);
  const [shaking, setShaking] = useState(false);

  const refresh = useCallback(() => {
    setChallenge(genChallenge());
    setInput('');
    setVerified(false);
    onVerified(false);
  }, [onVerified]);

  useEffect(() => { refresh(); }, [reset, refresh]);

  const handleInput = (val: string) => {
    setInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num === challenge.answer) {
      setVerified(true);
      onVerified(true);
    } else if (verified) {
      setVerified(false);
      onVerified(false);
    }
  };

  const handleBlurCheck = () => {
    if (input && !verified) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">人机验证</label>
      <div className={`flex items-center gap-2 ${shaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        <div className="flex-1 flex items-center gap-2 h-11 px-3 rounded-lg border border-[#E5E6EB] bg-gray-50 select-none">
          <span className="text-sm font-mono font-semibold text-gray-800 tracking-widest">{challenge.question}</span>
        </div>
        <Input
          value={input}
          onChange={e => handleInput(e.target.value)}
          onBlur={handleBlurCheck}
          placeholder="答案"
          className={`w-20 h-11 text-center font-mono transition-colors ${
            verified ? 'border-green-400 bg-green-50 text-green-700' : ''
          }`}
          maxLength={4}
          inputMode="numeric"
        />
        <button type="button" onClick={refresh}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0" title="换一题">
          <RefreshCw className="w-4 h-4" />
        </button>
        {verified && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
      </div>
      {shaking && <p className="text-xs text-red-500">答案有误，请重新计算</p>}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithUsername, signUpWithUsername } = useAuth();
  const [mode, setMode] = useState<LoginMode>('user');
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // 人机验证
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaReset, setCaptchaReset] = useState(0);
  // 注册步骤
  const [regStep, setRegStep] = useState<RegStep>(1);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);
  // 仅开发模式显示的调试验证码
  const [debugCode, setDebugCode] = useState('');

  // 倒计时
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const resetForm = () => {
    setUsername(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setAgreed(false); setCaptchaOk(false); setCaptchaReset(r => r + 1);
    setRegStep(1); setOtpCode(''); setOtpVerified(false); setDebugCode('');
  };

  const handleModeSwitch = (m: LoginMode) => {
    setMode(m);
    setIsLogin(true);
    resetForm();
  };

  // 步骤1：发送 OTP
  const handleSendOtp = async () => {
    if (!email.trim()) { toast.error('请填写邮箱地址'); return; }
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailReg.test(email)) { toast.error('邮箱格式不正确'); return; }
    setOtpSending(true);
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: { email: email.trim() },
    });
    setOtpSending(false);
    if (error) {
      const msg = await error?.context?.text?.() || error.message;
      toast.error('发送失败：' + msg);
      return;
    }
    if (data?.error) { toast.error(data.error); return; }
    toast.success('验证码已发送，请查收邮件');
    setRegStep(2);
    setOtpCooldown(60);
    if (data?.debug_code) setDebugCode(data.debug_code);
  };

  // 步骤2：验证 OTP
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length < 6) { toast.error('请输入6位验证码'); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { email: email.trim(), code: otpCode.trim() },
    });
    if (error || data?.error) {
      const msg = data?.error || (await error?.context?.text?.()) || error?.message;
      toast.error(msg || '验证失败');
      setLoading(false);
      return;
    }
    setOtpVerified(true);
    toast.success('邮箱验证通过！');
    // 完成注册
    const { error: signupError } = await signUpWithUsername(username, password, email.trim());
    setLoading(false);
    if (signupError) { toast.error('注册失败：' + signupError.message); return; }
    toast.success('注册成功，欢迎加入！');
    navigate('/');
  };

  // 登录 / 步骤1提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      // ─ 登录流程 ─
      if (!username || !password) { toast.error('请填写用户名和密码'); return; }
      if (!captchaOk) { toast.error('请完成人机验证'); return; }
      setLoading(true);
      const { error } = await signInWithUsername(username, password);
      setLoading(false);
      if (error) {
        toast.error('登录失败：' + error.message);
        setCaptchaReset(r => r + 1); // 登录失败刷新验证码
      } else {
        toast.success('登录成功');
        navigate(mode === 'admin' ? '/admin' : '/');
      }
    } else {
      // ─ 注册步骤1：校验表单 → 发送 OTP ─
      if (!username.trim()) { toast.error('请填写用户名'); return; }
      if (username.trim().length < 3) { toast.error('用户名至少3个字符'); return; }
      if (!email.trim()) { toast.error('请填写邮箱地址'); return; }
      if (password.length < 6) { toast.error('密码至少6位'); return; }
      if (password !== confirmPassword) { toast.error('两次密码输入不一致'); return; }
      if (!agreed) { toast.error('请同意用户协议和隐私政策'); return; }
      if (!captchaOk) { toast.error('请完成人机验证'); return; }
      await handleSendOtp();
    }
  };

  const isAdmin = mode === 'admin';

  return (
    <div className="min-h-screen flex bg-[#F0F2F7]">
      {/* 左侧装饰区（大屏显示） */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1251cc 0%, #165DFF 60%, #36a3ff 100%)' }}>
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col justify-center px-16 max-w-xl">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-8">
            <BookOpen className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight text-balance">大学生学习管理平台</h2>
          <p className="text-white/80 mt-4 text-lg leading-relaxed text-pretty">
            一站式管理课程任务与学习资料，智能提醒与打卡助力高效学习生活
          </p>
          <div className="flex gap-8 mt-12">
            {[['课程管理', '全部课程一览'], ['打卡计划', '养成学习习惯'], ['校园生活', '活动与资讯']].map(([title, sub]) => (
              <div key={title}>
                <p className="text-white font-semibold">{title}</p>
                <p className="text-white/60 text-sm mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧登录区 */}
      <div className="flex-1 flex items-center justify-center p-6 lg:max-w-[520px]">
        <div className="w-full max-w-md">
          {/* 返回门户首页 */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />返回首页
          </button>

          {/* Logo（移动端） */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#165DFF] rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">大学生学习平台</span>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-[#E5E6EB] overflow-hidden">
            {/* 模式切换 Tab */}
            <div className="flex border-b border-[#E5E6EB]">
              <button
                onClick={() => handleModeSwitch('user')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  !isAdmin
                    ? 'text-[#165DFF] border-b-2 border-[#165DFF] bg-[#165DFF]/4'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="w-4 h-4" />学生登录
              </button>
              <button
                onClick={() => handleModeSwitch('admin')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  isAdmin
                    ? 'text-[#FF7D00] border-b-2 border-[#FF7D00] bg-[#FF7D00]/4'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />管理员入口
              </button>
            </div>

            <div className="p-8">
              {/* ── 标题 ── */}
              <div className="mb-6">
                {!isLogin && regStep === 2 ? (
                  <div className="flex items-center gap-2 mb-1">
                    <button type="button" onClick={() => { setRegStep(1); setOtpCode(''); setOtpVerified(false); }}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">验证邮箱</h1>
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900">
                    {isAdmin ? '管理员登录' : isLogin ? '欢迎回来' : '创建账号'}
                  </h1>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {isAdmin ? '请使用管理员账号登录后台系统'
                    : isLogin ? '使用用户名和密码登录'
                    : regStep === 1 ? '注册新账号，开始你的学习旅程'
                    : `验证码已发送至 ${email}（有效期10分钟）`}
                </p>
              </div>

              {/* ── OTP 验证步骤 ── */}
              {!isLogin && regStep === 2 ? (
                <div className="space-y-4">
                  {/* 调试模式提示 */}
                  {debugCode && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700 font-mono">
                      🔧 开发模式验证码：<strong>{debugCode}</strong>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">邮箱验证码</label>
                    <div className="flex gap-2">
                      <Input
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="请输入6位验证码"
                        className={`flex-1 h-11 text-center text-lg font-mono tracking-[0.3em] ${
                          otpVerified ? 'border-green-400 bg-green-50' : ''
                        }`}
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      没收到邮件？
                      {otpCooldown > 0
                        ? <span className="text-gray-400"> {otpCooldown}s 后可重新发送</span>
                        : <button type="button" onClick={handleSendOtp} disabled={otpSending}
                            className="text-[#165DFF] hover:underline ml-0.5">
                            重新发送
                          </button>}
                    </p>
                  </div>

                  <Button type="button" onClick={handleVerifyOtp} disabled={loading || otpCode.length < 6}
                    className="w-full h-11 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white font-medium">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />验证中…</>
                      : '验证并完成注册'}
                  </Button>
                </div>
              ) : (
                /* ── 登录 / 注册步骤1 表单 ── */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">用户名</label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder={isAdmin ? '请输入管理员用户名' : '请输入用户名（至少3位）'}
                      className="h-11" autoComplete="username" />
                  </div>

                  {/* 注册时额外显示邮箱 */}
                  {!isLogin && !isAdmin && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        邮箱 <span className="text-red-400">*</span>
                        <span className="text-xs text-gray-400 font-normal ml-1">（用于接收验证码）</span>
                      </label>
                      <div className="relative">
                        <Input value={email} onChange={e => setEmail(e.target.value)}
                          type="email" placeholder="请输入真实邮箱地址"
                          className="h-11 pl-10" autoComplete="email" />
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">密码</label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} value={password}
                        onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码"
                        className="h-11 pr-10"
                        autoComplete={isLogin ? 'current-password' : 'new-password'} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isLogin && !isAdmin && (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">确认密码</label>
                        <Input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="请再次输入密码" className="h-11" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v as boolean)} />
                        <label htmlFor="agree" className="text-xs text-gray-500">
                          我已阅读并同意
                          <span className="text-[#165DFF] cursor-pointer">《用户协议》</span>和
                          <span className="text-[#165DFF] cursor-pointer">《隐私政策》</span>
                        </label>
                      </div>
                    </>
                  )}

                  {/* 人机验证 */}
                  <MathCaptcha onVerified={setCaptchaOk} reset={captchaReset} />

                  <Button type="submit"
                    className={`w-full h-11 text-white font-medium mt-2 ${
                      isAdmin ? 'bg-[#FF7D00] hover:bg-[#FF7D00]/90' : 'bg-[#165DFF] hover:bg-[#165DFF]/90'
                    }`}
                    disabled={loading || otpSending}>
                    {loading || otpSending
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{otpSending ? '发送中…' : '处理中…'}</>
                      : isAdmin ? '管理员登录'
                      : isLogin ? '登录'
                      : '下一步：验证邮箱'}
                  </Button>
                </form>
              )}

              {!isAdmin && (
                <div className="mt-5 text-center">
                  <button
                    onClick={() => { setIsLogin(!isLogin); resetForm(); }}
                    className="text-sm text-[#165DFF] hover:underline"
                  >
                    {isLogin ? '还没有账号？立即注册' : '已有账号？立即登录'}
                  </button>
                </div>
              )}

              {isAdmin && (
                <p className="mt-5 text-center text-xs text-gray-400">
                  如需管理员权限，请联系系统管理员开通
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
