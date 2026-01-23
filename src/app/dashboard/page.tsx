'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. ユーザー確認
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // 2. 所属店舗一覧を取得（複数対応）
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('owner_user_id', user.id);  // ← .single() ではなく全件

        if (storeError) throw storeError;

        if (!storeData || storeData.length === 0) {
          setErrorMsg('店舗が見つかりません。まずは店舗を作成してください。');
          setLoading(false);
          return;
        }

        setStores(storeData);

        // 3. デフォルトの店舗を選択（localStorageがあれば復元）
        const savedStoreId = localStorage.getItem('selectedStoreId');
        const initialStore = savedStoreId 
          ? storeData.find(s => s.id === savedStoreId)
          : storeData[0];

        const activeStoreId = initialStore?.id || storeData[0].id;
        setSelectedStoreId(activeStoreId);

        // 4. 選択店舗のデータ読み込み
        await loadStoreSpecificData(activeStoreId);
      } catch (err: any) {
        console.error(err);
        setErrorMsg('データの読み込みに失敗しました: ' + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // 店舗切り替え時のデータ再取得
  const loadStoreSpecificData = async (storeId: string) => {
    setLoading(true);
    try {
      // スタッフ一覧
      const { data: staffData } = await supabase
        .from('profiles')
        .select('*, user_stores!inner(role)')
        .eq('user_stores.store_id', storeId)
        .neq('id', user?.id);

      setStaff(staffData || []);

      // シフト希望（例: 今月分）
      const { data: prefData } = await supabase
        .from('shift_preferences')
        .select('*, profiles(name)')
        .eq('store_id', storeId)
        .gte('shift_date', '2026-01-01')
        .lte('shift_date', '2026-01-31');

      setPreferences(prefData || []);
    } catch (err: any) {
      console.error('店舗データ取得エラー:', err);
      setErrorMsg('店舗データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 店舗タブ切り替えハンドラ
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    localStorage.setItem('selectedStoreId', storeId);
    loadStoreSpecificData(storeId);
  };

  if (loading) return <div className="p-8 text-center">読み込み中...</div>;
  if (errorMsg) return <div className="p-8 text-red-600">{errorMsg}</div>;
  if (!user) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
                    {s.name} ({s.user_stores?.role || 'staff'}) 
                    - 最大連勤: {s.max_consecutive_days ?? '-'}日
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
                        <td className="p-3 border">{p.profiles?.name || '不明'}</td>
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