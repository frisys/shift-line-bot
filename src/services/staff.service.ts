import { supabase } from '@/lib/supabase/client';
import type { Staff } from '@/types';

/**
 * スタッフのプロフィール（名前）を更新
 */
export async function updateStaffProfile(staffId: string, data: { name: string }) {
  return supabase.from('profiles').update(data).eq('id', staffId);
}

/**
 * スタッフの店舗設定（役割、勤務制約など）を更新
 */
export async function updateStaffStoreSettings(
  userId: string,
  storeId: string,
  data: Partial<
    Pick<
      Staff,
      'role' | 'max_consecutive_days' | 'max_weekly_days' | 'unavailable_days' | 'preferred_time_slots'
    >
  >
) {
  return supabase
    .from('user_stores')
    .update(data)
    .eq('user_id', userId)
    .eq('store_id', storeId);
}
