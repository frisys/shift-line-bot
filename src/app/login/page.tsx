'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';  // クライアント用client.tsからimport（前回の例）

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage('エラー: ' + error.message);
    } else {
      setMessage('ログイン成功！ユーザーID: ' + data.user?.id);
      // 成功したら/testページにリダイレクト
      window.location.href = '/dashboard';
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>テストログイン</h1>
      <input
        type="email"
        placeholder="test@manager.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>ログイン</button>
      <p>{message}</p>
    </div>
  );
}