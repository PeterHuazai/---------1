import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://backend.appmiaoda.com/projects/supabase317223063336824832',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk1MDU5MDcyLCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.TPgsEtCQS5IN1cwVhgX8A6UW7yThP78DzS9PjHLd-Tk'
);

const username = 'admin';
const password = 'Admin@2026!Secure';
const email = `${username}@miaoda.com`;

const { data, error } = await supabase.auth.signUp({ email, password });
if (error) {
  console.error('注册失败:', error.message);
} else {
  console.log('注册成功:', email);
}
