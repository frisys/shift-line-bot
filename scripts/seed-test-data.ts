// テスト用ダミーデータ投入スクリプト
// 実行: npx tsx scripts/seed-test-data.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log('🌱 テストデータを投入します...\n');

  // 1. テスト用店舗を作成
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .upsert({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'テスト店舗',
      store_code: 'TEST001',
      required_staff: { mon: 3, tue: 3, wed: 3, thu: 3, fri: 4, sat: 5, sun: 5 },
    }, { onConflict: 'id' })
    .select()
    .single();

  if (storeError) {
    console.error('❌ 店舗作成エラー:', storeError.message);
    return;
  }
  console.log('✅ 店舗作成:', store.name, `(${store.store_code})`);

  // 2. テスト用ユーザーを作成
  const testUsers = [
    { line_user_id: 'U_TEST_USER_001', name: '田中太郎' },
    { line_user_id: 'U_TEST_USER_002', name: '佐藤花子' },
    { line_user_id: 'U_TEST_USER_003', name: '山田次郎' },
  ];

  for (const user of testUsers) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(user, { onConflict: 'line_user_id' });

    if (profileError) {
      console.error(`❌ ユーザー作成エラー (${user.name}):`, profileError.message);
      continue;
    }
    console.log('✅ ユーザー作成:', user.name, `(${user.line_user_id})`);

    // 3. ユーザーを店舗に紐づけ
    const { error: userStoreError } = await supabase
      .from('user_stores')
      .upsert({
        user_id: user.line_user_id,
        store_id: store.id,
        role: 'staff',
        max_consecutive_days: 5,
        max_weekly_days: 5,
      }, { onConflict: 'user_id,store_id' });

    if (userStoreError) {
      console.error(`❌ 店舗紐づけエラー (${user.name}):`, userStoreError.message);
    }
  }

  console.log('\n✨ 完了！\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ブラウザで確認するURL:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`http://localhost:3000/shift-select?year=2026&month=3&userId=U_TEST_USER_001&storeId=${store.id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seed().catch(console.error);
