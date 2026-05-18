import { supabase } from '@/lib/supabase/client';
import type { Staff } from '@/types';

export async function updateStaffProfile(staffId: string, data: { name: string }) {
  return supabase.from('profiles').update(data).eq('id', staffId);
}

// user_stores の RLS はスタッフ本人しか更新できないため、サービスロールキーを持つ API 経由で更新する
export async function updateStaffStoreSettings(
  lineUserId: string,
  storeId: string,
  data: Partial<
    Pick<
      Staff,
      'role' | 'max_consecutive_days' | 'max_weekly_days' | 'unavailable_days' | 'preferred_time_slots'
    >
  >
) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { error: new Error('Not authenticated') };

  const res = await fetch(`/api/stores/${storeId}/staff`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ lineUserId, ...data }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { error: new Error(json.error ?? `HTTP ${res.status}`) };
  }

  return { error: null };
}
