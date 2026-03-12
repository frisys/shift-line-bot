'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Store } from '@/types';

export default function TestPage() {
  const [stores, setStores] = useState<Store[]>([]);

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
