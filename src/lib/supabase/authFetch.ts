// lib/supabase/authFetch.ts
// Supabaseセッションのアクセストークンを付与してAPIを呼ぶ共通fetch。
// サーバー側が401(トークン無効)を返した場合は、ローカルにセッションが残っていても
// 強制的にサインアウトしてログイン画面へ戻す。
import { supabase } from './client';

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return res;
}
