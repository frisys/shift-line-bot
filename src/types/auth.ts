import type { User } from '@supabase/supabase-js';

// AuthContextの値の型定義
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
}
