'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/SupabaseProvider';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { user: authUser, loading: authLoading } = useAuth();

  useEffect(() => {
  let isMounted = true;  // アンマウントチェック用
    async function loadData() {
      if (!isMounted) return;
      setLoading(true);
      try {
        // 1. ユーザー確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }
        const currentUser = session.user;
        setUser(currentUser);
        console.log('Logged in user:', currentUser);

        // 2. 所属店舗一覧を取得（複数対応）
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('owner_user_id', currentUser.id);  // ← .single() ではなく全件
        console.log('Fetched stores:', storeData);

        if (storeError) throw storeError;

        if (!storeData || storeData.length === 0) {
          setErrorMsg('店舗が見つかりません。まずは店舗を作成してください。');
          return;
        }

        setStores(storeData);

        // 3. デフォルトの店舗を選択（localStorageがあれば復元）
        const saved = localStorage.getItem('selectedStoreId');
        const initial = saved ? storeData.find(s => s.id === saved) : storeData[0];
        const activeId = initial?.id || storeData[0].id;

        setSelectedStoreId(activeId);
        console.log('Selected store ID:', activeId);

        // 4. 選択店舗のデータ読み込み
        await loadStoreSpecificData(activeId);
      } catch (err: any) {
        console.error(err);
        setErrorMsg('データの読み込みに失敗しました: ' + err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;  // アンマウント時にフラグオフ
    };
  }, [router]);

  // 店舗が変わったら再読み込み（これが大事！）
  useEffect(() => {
    if (selectedStoreId) {
      loadStoreSpecificData(selectedStoreId);
    }
  }, [selectedStoreId]);
  
  // 店舗タブ切り替えハンドラ
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    localStorage.setItem('selectedStoreId', storeId);
  };

  // loadStoreSpecificData内のスタッフ取得をまるごと置き換え
  const loadStoreSpecificData = async (storeId: string) => {
    if (!storeId) {
      setStaff([]);
      return;
    }

    console.log('Loading data for store ID:', storeId);
  // user_stores から取得して profiles をネストで含める
  const { data: userStores, error } = await supabase
    .from('user_stores')
    .select('role, profiles(*)')
    .eq('store_id', storeId)
    .neq('user_id', user?.id ?? '');

  if (error) {
    console.error(error);
    setStaff([]);
    return;
  }

  // 必要な形に整形
  const staffArr = (userStores || []).map((us: any) => {
    const profile = us.profiles || {};
    return {
      id: profile.id,
      name: profile.name,
      max_consecutive_days: profile.max_consecutive_days,
      max_weekly_days: profile.max_weekly_days,
      user_stores: { role: us.role },
    };
  });

  console.log('スタッフ取得結果:', staffArr);
  setStaff(staffArr);
  };

  if (loading) return <div className="p-8 text-center">読み込み中...</div>;
  if (errorMsg) return <div className="p-8 text-red-600">{errorMsg}</div>;
  if (authLoading) return <div>認証確認中...</div>;
  if (!user) router.push('/login');

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white text-black dark:bg-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>
      <p className="mb-4">ようこそ、{user.email}さん</p>

      {/* 店舗タブ / セレクト */}
      {stores.length > 1 ? (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">表示店舗を選択</label>
          <select
            value={selectedStoreId || ''}
            onChange={(e) => handleStoreChange(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        stores[0] && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{stores[0].name}</h2>
          </div>
        )
      )}

      {/* 店舗情報 */}
      {selectedStoreId && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">店舗情報</h2>
            <div className="bg-gray-50 p-4 rounded border">
              {stores.find(s => s.id === selectedStoreId) && (
                <pre className="text-sm">
                  必要人数テンプレ: {JSON.stringify(stores.find(s => s.id === selectedStoreId)?.required_staff, null, 2)}
                </pre>
              )}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">スタッフ一覧</h2>
            {staff.length === 0 ? (
              <p className="text-gray-500">スタッフが見つかりません</p>
            ) : (
              <ul className="space-y-2">
                {staff.map(s => (
                  <li key={s.id} className="bg-white p-3 rounded border">
                    {s.name || '（名前未設定）'} 
                    ({s.user_stores?.role || 'staff'}) 
                    - 最大連勤: {s.max_consecutive_days != null ? `${s.max_consecutive_days}日` : '-'}
                    - 週最大: {s.max_weekly_days != null ? `${s.max_weekly_days}日` : '-'}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">シフト希望一覧（今月）</h2>
            {preferences.length === 0 ? (
              <p className="text-gray-500">希望データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-3 text-left border">スタッフ</th>
                      <th className="p-3 text-left border">日付</th>
                      <th className="p-3 text-left border">ステータス</th>
                      <th className="p-3 text-left border">時間帯</th>
                      <th className="p-3 text-left border">備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preferences.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="p-3 border">
                          {p.profiles?.name || p.user_id.substring(0, 8) + '...' || '不明'}
                        </td>
                        <td className="p-3 border">{p.shift_date}</td>
                        <td className="p-3 border">{p.status}</td>
                        <td className="p-3 border">{p.time_slot || '-'}</td>
                        <td className="p-3 border">{p.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <button 
        onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
        className="mt-8 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        ログアウト
      </button>
    </div>
  );
}