 // シフト希望型
export interface ShiftPreference {
  id: string;
  user_id: string;
  store_id: string;
  shift_date: string; // 'YYYY-MM-DD'
  status: 'ok' | 'maybe' | 'no';
  time_slot: string | null;
  note: string | null;
  submitted_at: string;
  updated_at: string;
  profiles?: { name: string | null }; // JOINで取得した場合
}