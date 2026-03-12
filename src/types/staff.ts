import type { StaffRole } from '@/constants/roles';

export interface Staff {
  id: string;
  name: string | null;
  role: StaffRole;
  store_id: string;
  line_user_id: string;
  max_consecutive_days: number | null;
  max_weekly_days: number | null;
  unavailable_days?: string[];
  preferred_time_slots?: string[];
}