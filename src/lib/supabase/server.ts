// lib/supabase/server.ts
// サーバーサイド専用。クライアントには絶対にインポートしないこと。

import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
