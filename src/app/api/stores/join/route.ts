import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = createServerClient();

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { storeCode } = await request.json();
  if (!storeCode?.trim()) return NextResponse.json({ error: 'storeCode は必須です' }, { status: 400 });

  const { data: store, error: storeError } = await supabaseAdmin
    .from('stores')
    .select('id, name, store_code')
    .eq('store_code', storeCode.trim().toUpperCase())
    .single();

  if (storeError || !store) {
    return NextResponse.json({ error: '店舗コードが見つかりません' }, { status: 404 });
  }

  // オーナー本人は参加不要
  const { data: ownerCheck } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('id', store.id)
    .eq('owner_user_id', user.id)
    .single();

  if (ownerCheck) {
    return NextResponse.json({ error: 'この店舗はすでにあなたが管理しています' }, { status: 409 });
  }

  // 既存メンバーチェック
  const { data: existing } = await supabaseAdmin
    .from('user_stores')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('store_id', store.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'この店舗にはすでに参加しています' }, { status: 409 });
  }

  const { error: insertError } = await supabaseAdmin
    .from('user_stores')
    .insert({ user_id: user.id, store_id: store.id, role: 'manager' });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ store });
}
