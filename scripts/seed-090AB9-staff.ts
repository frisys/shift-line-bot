// 店舗コード 090AB9 向けテストスタッフ20人投入スクリプト
// 実行: npx tsx scripts/seed-090AB9-staff.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// importより後に実行されるためseed()内でクライアントを生成する
dotenv.config();

const STORE_CODE = '090AB9';

const TEST_STAFF = [
  { line_user_id: 'Utest090AB900000000000000000000001', name: '田中 太郎' },
  { line_user_id: 'Utest090AB900000000000000000000002', name: '佐藤 花子' },
  { line_user_id: 'Utest090AB900000000000000000000003', name: '鈴木 一郎' },
  { line_user_id: 'Utest090AB900000000000000000000004', name: '高橋 明美' },
  { line_user_id: 'Utest090AB900000000000000000000005', name: '伊藤 健二' },
  { line_user_id: 'Utest090AB900000000000000000000006', name: '渡辺 さくら' },
  { line_user_id: 'Utest090AB900000000000000000000007', name: '山本 浩二' },
  { line_user_id: 'Utest090AB900000000000000000000008', name: '中村 由美' },
  { line_user_id: 'Utest090AB900000000000000000000009', name: '小林 大輔' },
  { line_user_id: 'Utest090AB900000000000000000000010', name: '加藤 真由美' },
  { line_user_id: 'Utest090AB900000000000000000000011', name: '吉田 隆' },
  { line_user_id: 'Utest090AB900000000000000000000012', name: '山田 涼子' },
  { line_user_id: 'Utest090AB900000000000000000000013', name: '佐々木 誠' },
  { line_user_id: 'Utest090AB900000000000000000000014', name: '松本 美香' },
  { line_user_id: 'Utest090AB900000000000000000000015', name: '井上 翔太' },
  { line_user_id: 'Utest090AB900000000000000000000016', name: '木村 あい' },
  { line_user_id: 'Utest090AB900000000000000000000017', name: '林 雄太' },
  { line_user_id: 'Utest090AB900000000000000000000018', name: '斎藤 菜々子' },
  { line_user_id: 'Utest090AB900000000000000000000019', name: '清水 康介' },
  { line_user_id: 'Utest090AB900000000000000000000020', name: '山口 ひとみ' },
];

const STATUSES = ['ok', 'ok', 'ok', 'maybe', 'no'] as const;
const TIME_SLOTS = ['早番', '日勤', '遅番', 'フル', null] as const;

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 指定年月の全日付を YYYY-MM-DD 配列で返す */
function getMonthDates(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, d) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
  });
}

async function seed() {
  // dotenv.config() 後にクライアントを生成して環境変数を確実に読み込む
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`🌱 店舗コード ${STORE_CODE} のテストデータを投入します...\n`);

  // 1. 店舗を取得
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('store_code', STORE_CODE)
    .single();

  if (storeError || !store) {
    console.error(`❌ 店舗が見つかりません (store_code: ${STORE_CODE}):`, storeError?.message);
    process.exit(1);
  }
  console.log(`✅ 店舗確認: ${store.name} (id: ${store.id})\n`);

  // 2. profiles 登録
  console.log('── profiles 登録 ──');
  const { error: profilesError } = await supabase
    .from('profiles')
    .upsert(
      TEST_STAFF.map(s => ({ line_user_id: s.line_user_id, name: s.name })),
      { onConflict: 'line_user_id' }
    );

  if (profilesError) {
    console.error('❌ profiles 登録エラー:', profilesError.message);
    process.exit(1);
  }
  console.log(`✅ ${TEST_STAFF.length}件 登録完了\n`);

  // 3. user_stores 登録
  console.log('── user_stores 登録 ──');
  const maxConsecutiveOptions = [3, 4, 5, 5, 5, 5, 6];
  const maxWeeklyOptions      = [3, 4, 4, 5, 5, 5, 5];
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const { error: userStoresError } = await supabase
    .from('user_stores')
    .upsert(
      TEST_STAFF.map(s => ({
        user_id: s.line_user_id,
        store_id: store.id,
        role: 'staff',
        max_consecutive_days: randomItem(maxConsecutiveOptions),
        max_weekly_days: randomItem(maxWeeklyOptions),
        unavailable_days: Math.random() < 0.4 ? [randomItem(weekdays)] : [],
        preferred_time_slots: Math.random() < 0.5 ? [randomItem(['早番', '日勤', '遅番', 'フル'])] : [],
      })),
      { onConflict: 'user_id,store_id' }
    );

  if (userStoresError) {
    console.error('❌ user_stores 登録エラー:', userStoresError.message);
    process.exit(1);
  }
  console.log(`✅ ${TEST_STAFF.length}件 登録完了\n`);

  // 4. shift_preferences 登録（今月・来月）
  const now = new Date();
  const targets = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    {
      year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(),
      month: now.getMonth() === 11 ? 1 : now.getMonth() + 2,
    },
  ];

  for (const { year, month } of targets) {
    console.log(`── shift_preferences 登録 (${year}年${month}月) ──`);
    const dates = getMonthDates(year, month);
    const prefs: object[] = [];

    for (const staff of TEST_STAFF) {
      for (const date of dates) {
        // 約70%の日に希望を入れる
        if (Math.random() > 0.70) continue;
        const status = randomItem(STATUSES);
        const time_slot = (status === 'ok' || status === 'maybe') ? randomItem(TIME_SLOTS) : null;
        prefs.push({
          user_id: staff.line_user_id,
          store_id: store.id,
          shift_date: date,
          status,
          time_slot,
          note: null,
        });
      }
    }

    const { error: prefsError } = await supabase
      .from('shift_preferences')
      .upsert(prefs, { onConflict: 'user_id,store_id,shift_date' });

    if (prefsError) {
      console.error(`❌ shift_preferences 登録エラー (${year}/${month}):`, prefsError.message);
    } else {
      console.log(`✅ ${prefs.length}件 登録完了\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ 完了！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`店舗 ID : ${store.id}`);
  console.log(`スタッフ: ${TEST_STAFF.length}人`);
  console.log('シフト希望: 今月・来月分を投入済み');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seed().catch(console.error);
