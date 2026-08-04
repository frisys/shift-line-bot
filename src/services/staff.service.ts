import { supabase } from '@/lib/supabase/client';
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
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { staff: null, error: new Error('Not authenticated') };

  const res = await fetch(`/api/stores/${storeId}/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });

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
