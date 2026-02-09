// 店舗型
export interface Store {
  id: string;
  name: string;
  owner_user_id: string;
  required_staff: Record<string, number>; // { mon: 3, tue: 4, ... }
  address?: string | null;
  created_at: string;
  updated_at: string;
}