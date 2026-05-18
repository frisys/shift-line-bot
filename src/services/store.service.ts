import { supabase } from '@/lib/supabase/client';

/**
 * 店舗の必要人数設定を更新
 */
export async function updateRequiredStaff(
  storeId: string,
  requiredStaff: Record<string, number | Record<string, number>>
) {
  return supabase
    .from('stores')
    .update({ required_staff: requiredStaff })
    .eq('id', storeId);
}

/**
 * 店舗の勤務区分リストを更新
 */
export async function updateTimeSlots(storeId: string, timeSlots: string[]) {
  return supabase
    .from('stores')
    .update({ time_slots: timeSlots })
    .eq('id', storeId);
}
