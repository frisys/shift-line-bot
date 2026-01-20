'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export default function TestPage() {
  const [stores, setStores] = useState<any[]>([]);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchData() {
      // ログインしてからテスト（最初はanonキーだけでもOK）
      const { data, error } = await supabase.from('stores').select('*');
      if (error) console.error(error);
      else setStores(data);
    }
    fetchData();
  }, []);

  return (
    <div>
      <h1>テスト: Stores一覧</h1>
      <pre>{JSON.stringify(stores, null, 2)}</pre>
    </div>
  );
}
