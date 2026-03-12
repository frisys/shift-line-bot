import { supabase } from '@/lib/supabase/client';

/**
 * 店舗の必要人数設定を更新
 */
export async function updateRequiredStaff(
  storeId: string,
  requiredStaff: Record<string, number>
) {
  return supabase
    .from('stores')
    .update({ required_staff: requiredStaff })
    .eq('id', storeId);
}
