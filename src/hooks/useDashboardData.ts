// hooks/useDashboardData.ts
'use client';

const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== 'production') console.log(...args); };

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User, Store, Staff, ShiftPreference } from '@/types';

export function useDashboardData() {
  const [user, setUser] = useState<User | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [preferences, setPreferences] = useState<ShiftPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 初回ロード
  useEffect(() => {
    async function initLoad() {
      setLoading(true);
      devLog('[useDashboardData] initLoad: 開始');
      try {
        devLog('[useDashboardData] supabase.auth.getSession: 開始');
        const { data: { session } } = await supabase.auth.getSession();
        devLog('[useDashboardData] supabase.auth.getSession: 完了', { userId: session?.user?.id });
        if (!session?.user) {
          devLog('[useDashboardData] セッションなし → /login へリダイレクト');
          window.location.href = '/login';
          return;
        }

        const currentUser: User = {
          id: session.user.id,
          email: session.user.email,
        };
        setUser(currentUser);

        devLog('[useDashboardData] stores 取得: 開始', { owner_user_id: currentUser.id });
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const accessToken = currentSession?.access_token;

        const [ownedResult, managedRes] = await Promise.all([
          supabase.from('stores').select('*').eq('owner_user_id', currentUser.id),
          accessToken
            ? fetch('/api/stores/managed', { headers: { Authorization: `Bearer ${accessToken}` } })
                .then(r => r.ok ? r.json() : { stores: [] })
            : Promise.resolve({ stores: [] }),
        ]);
        devLog('[useDashboardData] stores 取得: 完了', { owned: ownedResult.data?.length, managed: managedRes.stores?.length });

        if (ownedResult.error) throw ownedResult.error;

        const ownedStores: Store[] = (ownedResult.data as Store[]) ?? [];
        const managedStores: Store[] = (managedRes.stores as Store[]) ?? [];
        const seenIds = new Set(ownedStores.map((s: Store) => s.id));
        const merged = [...ownedStores, ...managedStores.filter((s: Store) => !seenIds.has(s.id))];

        if (!merged.length) {
          setStores([]);
          setLoading(false);
          return;
        }

        setStores(merged);

        // デフォルト選択
        const saved = localStorage.getItem('selectedStoreId');
        const initial = saved ? merged.find((s: Store) => s.id === saved) : merged[0];
        const activeId = initial?.id || merged[0].id;
        devLog('[useDashboardData] selectedStoreId を設定:', activeId);
        setSelectedStoreId(activeId);
      } catch (err: unknown) {
        console.error('[useDashboardData] initLoad エラー:', err);
        setErrorMsg(err instanceof Error ? err.message : '初期ロードに失敗しました');
      } finally {
        setLoading(false);
        devLog('[useDashboardData] initLoad: 終了');
      }
    }

    initLoad();
  }, []);

  // 店舗が変わったらデータ再取得
  useEffect(() => {
    if (!selectedStoreId || !user) return;

    async function fetchStoreData() {
      setLoading(true);
      devLog('[useDashboardData] fetchStoreData: 開始', { selectedStoreId });
      try {
        // スタッフ（user_stores は RLS でクライアントから読めないため API 経由）
        devLog('[useDashboardData] staff API 取得: 開始', { store_id: selectedStoreId });
        const { data: { session } } = await supabase.auth.getSession();
        const staffRes = await fetch(`/api/stores/${selectedStoreId}/staff`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!staffRes.ok) {
          throw new Error(`staff API エラー: ${staffRes.status}`);
        }
        const { staff: staffList } = await staffRes.json() as { staff: Staff[] };
        devLog('[useDashboardData] staff API 取得: 完了', { count: staffList.length });
        setStaff(staffList);

        // シフト希望（前月〜3ヶ月先まで取得）
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
          .toISOString().split('T')[0];
        const endDate = new Date(today.getFullYear(), today.getMonth() + 4, 0)
          .toISOString().split('T')[0];

        devLog('[useDashboardData] shift_preferences 取得: 開始', { store_id: selectedStoreId, startDate, endDate });
        const prefsRes = await fetch(
          `/api/stores/${selectedStoreId}/shift-preferences?startDate=${startDate}&endDate=${endDate}`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        if (!prefsRes.ok) {
          throw new Error(`shift-preferences API エラー: ${prefsRes.status}`);
        }
        const { preferences: enrichedPrefs } = await prefsRes.json() as { preferences: ShiftPreference[] };
        devLog('[useDashboardData] shift_preferences 取得: 完了', { count: enrichedPrefs.length });
        setPreferences(enrichedPrefs);
      } catch (err: unknown) {
        console.error('[useDashboardData] fetchStoreData エラー:', err);
        setErrorMsg(err instanceof Error ? err.message : '店舗データ取得に失敗しました');
      } finally {
        setLoading(false);
        devLog('[useDashboardData] fetchStoreData: 終了');
      }
    }

    fetchStoreData();
  }, [selectedStoreId, user]);

  return {
    user,
    stores,
    setStores,
    selectedStoreId,
    setSelectedStoreId,
    staff,
    setStaff,
    preferences,
    loading,
    errorMsg,
  };
}
