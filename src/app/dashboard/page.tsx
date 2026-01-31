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
        await loadStaff(activeId);
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

  // loadStoreSpecificData内のスタッフ取得をまるごと置き換え
  const loadStaff = async (storeId?: string) => {
    if (!storeId) {
      setStaff([]);
      return;
    }

    // 1. user_storesからこの店舗の全所属を取る
    const { data: memberships } = await supabase
      .from('user_stores')
      .select('user_id, role')
      .eq('store_id', storeId);

    console.log('user_storesから取れた全所属件数:', memberships?.length || 0);
    console.log('所属データ詳細:', memberships);

    if (!memberships?.length) {
      setStaff([]);
      return;
    }

    // 2. user_idリストでprofilesを取る（名前・連勤日数など）
    const userIds = memberships.map(m => m.user_id);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, max_consecutive_days, max_weekly_days')
      .in('id', userIds);

    console.log('profilesから取れた件数:', profilesData?.length || 0);

    // 3. roleをマージして最終リスト作成
    const fullStaff = profilesData?.map(p => {
      const mem = memberships.find(m => m.user_id === p.id);
      return {
        ...p,
        role: mem?.role || '不明'
      };
    }) || [];

    console.log('画面にセットするスタッフ一覧:', fullStaff);
    setStaff(fullStaff);
  };

  // 店舗タブ切り替えハンドラ
  const handleStoreChange = (storeId: string, userId: string) => {
    setSelectedStoreId(storeId);
    localStorage.setItem('selectedStoreId', storeId);
    loadStaff();
  };

  if (loading) return <div className="p-8 text-center">読み込み中...</div>;
  if (errorMsg) return <div className="p-8 text-red-600">{errorMsg}</div>;
  if (authLoading) return <div>認証確認中...</div>;
  if (!user) router.push('/login');

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
            onChange={(e) => handleStoreChange(e.target.value, user.id)}
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