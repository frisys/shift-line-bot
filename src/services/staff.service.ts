import { supabase } from '@/lib/supabase/client';
import { authFetch } from '@/lib/supabase/authFetch';
import type { Staff } from '@/types';

export async function updateStaffProfile(staffId: string, data: { display_name: string | null }) {
  return supabase.from('profiles').update(data).eq('id', staffId);
}

export async function createStaff(
  storeId: string,
  data: {
    name: string;
    role?: Staff['role'];
    max_consecutive_days?: number | null;
    max_weekly_days?: number | null;
    unavailable_days?: string[];
    preferred_time_slots?: string[];
    hourly_wage?: number | null;
  }
): Promise<{ staff: Staff | null; error: Error | null }> {
  let res: Response;
  try {
    res = await authFetch(`/api/stores/${storeId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    return { staff: null, error: err instanceof Error ? err : new Error('Not authenticated') };
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { staff: null, error: new Error(json.error ?? `HTTP ${res.status}`) };
  }

  const json = await res.json();
  return { staff: json.staff as Staff, error: null };
}

// user_stores の RLS はスタッフ本人しか更新できないため、サービスロールキーを持つ API 経由で更新する
export async function updateStaffStoreSettings(
  lineUserId: string,
  storeId: string,
  data: Partial<
    Pick<
      Staff,
      'role' | 'max_consecutive_days' | 'max_weekly_days' | 'unavailable_days' | 'preferred_time_slots' | 'hourly_wage'
    >
  >
) {
  let res: Response;
  try {
    res = await authFetch(`/api/stores/${storeId}/staff`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId, ...data }),
    });
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Not authenticated') };
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { error: new Error(json.error ?? `HTTP ${res.status}`) };
  }

  return { error: null };
}
