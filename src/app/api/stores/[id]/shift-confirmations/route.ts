// app/api/stores/[id]/shift-confirmations/route.ts
// shift_confirmations テーブルへのシフト作成結果の保存・取得
//
// 必要な DB マイグレーション（未実行の場合）:
//   ALTER TABLE shift_confirmations
//     ADD COLUMN IF NOT EXISTS assignments JSONB,
//     ADD COLUMN IF NOT EXISTS score       INTEGER,
//     ADD COLUMN IF NOT EXISTS detail      JSONB;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

async function authorizeStoreOwner(request: NextRequest, storeId: string) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { error: 'Unauthorized', status: 401 as const };

  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: 'Unauthorized', status: 401 as const };

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_user_id', user.id)
    .single();
  if (!store) return { error: 'Forbidden', status: 403 as const };

  return { error: null, status: 200 as const };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const yearMonth = request.nextUrl.searchParams.get('year_month');
  if (!yearMonth) return NextResponse.json({ error: 'year_month is required' }, { status: 400 });

  const auth = await authorizeStoreOwner(request, storeId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('shift_confirmations')
    .select('year_month, is_confirmed, assignments, score, detail')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)
    .single();

  // PGRST116 = row not found（正常ケース）
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ confirmation: data ?? null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;

  const auth = await authorizeStoreOwner(request, storeId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { year_month, assignments, score, detail } = await request.json();
  if (!year_month) return NextResponse.json({ error: 'year_month is required' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from('shift_confirmations')
    .upsert(
      { store_id: storeId, year_month, assignments, score, detail, is_confirmed: false },
      { onConflict: 'store_id,year_month' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
