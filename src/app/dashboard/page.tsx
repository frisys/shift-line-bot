'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      // 現在のユーザー取得
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // 自分の店舗取得（owner_user_id = auth.uid() でRLSが効く）
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (storeError) {
        console.error('店舗取得エラー:', storeError);
      }

      if (storeData) {
        setStores([storeData]);

        // スタッフ一覧
        const { data: staffData } = await supabase
          .from('profiles')
          .select('*')
          .eq('store_id', storeData.id)
          .neq('id', user.id); // 自分（店長）以外

        setStaff(staffData || []);

        // シフト希望（今月分だけ例）
        const { data: prefData } = await supabase
          .from('shift_preferences')
          .select('*, users(name)') // usersテーブルと結合して名前表示
          .eq('store_id', storeData.id)
          .gte('shift_date', '2026-01-01') // 今月分
          .lte('shift_date', '2026-01-31');

        setPreferences(prefData || []);
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  if (loading) return <div>読み込み中...</div>;
  if (!user) return null;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>ダッシュボード</h1>
      <p>ようこそ、{user.email}さん（店長）</p>

      <h2>あなたの店舗</h2>
      {stores.map(store => (
        <div key={store.id}>
          <h3>{store.name}</h3>
          <pre>必要人数テンプレ: {JSON.stringify(store.required_staff)}</pre>
        </div>
      ))}

      <h2>スタッフ一覧</h2>
      <ul>
        {staff.map(s => (
          <li key={s.id}>
            {s.name} ({s.role}) - 最大連勤: {s.max_consecutive_days}日
          </li>
        ))}
      </ul>

      <h2>今月のシフト希望</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>スタッフ</th>
            <th>日付</th>
            <th>ステータス</th>
            <th>時間帯</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>
          {preferences.map(p => (
            <tr key={p.id}>
              <td>{p.users?.name || '不明'}</td>
              <td>{p.shift_date}</td>
              <td>{p.status}</td>
              <td>{p.time_slot || '-'}</td>
              <td>{p.note || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
        ログアウト
      </button>
    </div>
  );
}