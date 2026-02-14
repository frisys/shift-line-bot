export interface Staff {
  id: string;
  name: string | null;
  role: 'manager' | 'staff' | 'admin' | string;
  store_id: string;
  line_user_id: string; // LINEのユーザーIDを紐づける
  max_consecutive_days: number | null;           // ← user_storesから来る
  max_weekly_days: number | null;                // ← user_storesから来る
  unavailable_days?: string[];                   // ← user_storesから来る
  preferred_time_slots?: string[];               // ← user_storesから来る
}