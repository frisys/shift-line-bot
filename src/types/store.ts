// 店舗型
export interface Store {
  id: string;
  name: string;
  owner_user_id: string;
  required_staff: Record<string, number | Record<string, number>>; // new: { mon: { '早番': 2 } } / legacy: { mon: 3 }
  time_slots?: string[] | null; // 勤務区分リスト ['早番', '日勤', ...]
  address?: string | null;
  store_code: string; // 店舗コード（英数4〜10文字）
  created_at: string;
  updated_at: string;
}