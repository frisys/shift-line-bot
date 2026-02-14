// hooks/useDashboardData.ts
'use client';

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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          window.location.href = '/login';
          return;
        }

        const currentUser: User = {
          id: session.user.id,
          email: session.user.email,
        };
        setUser(currentUser);

        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('owner_user_id', currentUser.id);

        if (storeError) throw storeError;

        if (!storeData?.length) {
          setErrorMsg('店舗が見つかりません');
          return;
        }

        setStores(storeData as Store[]);

        // デフォルト選択
        const saved = localStorage.getItem('selectedStoreId');
        const initial = saved ? storeData.find(s => s.id === saved) : storeData[0];
        const activeId = initial?.id || storeData[0].id;
        setSelectedStoreId(activeId);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : '初期ロードに失敗しました');
      } finally {
        setLoading(false);
      }
    }

    initLoad();
  }, []);

  // 店舗が変わったらデータ再取得
  useEffect(() => {
    if (!selectedStoreId || !user) return;

    async function fetchStoreData() {
      setLoading(true);
      try {
        // スタッフ
        const { data: memberships } = await supabase
          .from('user_stores')
          .select('user_id, line_user_id, role, max_consecutive_days, max_weekly_days, unavailable_days, preferred_time_slots')
          .eq('store_id', selectedStoreId);

        const userIds = memberships?.map(m => m.user_id) || [];

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        const staffList: Staff[] = profilesData?.map(p => {
          const mem = memberships?.find(m => m.user_id === p.id);
          return {
            id: p.id,
            name: p.name,
            role: mem?.role || 'staff',
            store_id: selectedStoreId || '',
            line_user_id: mem?.line_user_id || '',
            max_consecutive_days: mem?.max_consecutive_days ?? 5,
            max_weekly_days: mem?.max_weekly_days ?? 5,
            unavailable_days: mem?.unavailable_days ?? [],
            preferred_time_slots: mem?.preferred_time_slots ?? [],
          };
        }) || [];

        setStaff(staffList);

        // シフト希望
        const { data: prefs } = await supabase
          .from('shift_preferences')
          .select('*')
          .eq('store_id', selectedStoreId)
          .gte('shift_date', '2026-01-01')
          .lte('shift_date', '2026-01-31');

        const prefUserIds = [...new Set(prefs?.map(p => p.user_id) || [])];
        const { data: nameData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', prefUserIds);

        const nameMap: Record<string, string> = {};
        nameData?.forEach(n => {
          nameMap[n.id] = n.name || '不明';
        });

        const enrichedPrefs: ShiftPreference[] = prefs?.map(p => ({
          ...p,
          profiles: { name: nameMap[p.user_id] || '不明' }
        })) || [];

        setPreferences(enrichedPrefs);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : '店舗データ取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchStoreData();
  }, [selectedStoreId, user]);

  return {
    user,
    stores,
    selectedStoreId,
    setSelectedStoreId,
    staff,
    preferences,
    loading,
    errorMsg,
  };
}