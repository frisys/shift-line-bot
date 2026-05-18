// app/api/stores/[id]/staff/route.ts
// user_stores は RLS でクライアントから読めないため、サービスロールキーで取得する

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;

  // セッション確認（認証済みユーザーのみ許可）
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createServerClient();

  // トークンからユーザーを取得
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 店舗がこのユーザーのものか確認
  const { data: store, error: storeError } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_user_id', user.id)
    .single();

  if (storeError || !store) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // user_stores 取得（RLS バイパス）
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('user_stores')
    .select('user_id, role, max_consecutive_days, max_weekly_days, unavailable_days, preferred_time_slots')
    .eq('store_id', storeId);

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const lineUserIds = memberships?.map(m => m.user_id) ?? [];

  if (lineUserIds.length === 0) {
    return NextResponse.json({ staff: [] });
  }

  // profiles 取得
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, name, line_user_id')
    .in('line_user_id', lineUserIds);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const staff = profilesData?.map(p => {
    const mem = memberships?.find(m => m.user_id === p.line_user_id);
    return {
      id: p.id,
      name: p.name,
      role: mem?.role ?? 'staff',
      store_id: storeId,
      line_user_id: p.line_user_id ?? '',
      max_consecutive_days: mem?.max_consecutive_days ?? 5,
      max_weekly_days: mem?.max_weekly_days ?? 5,
      unavailable_days: mem?.unavailable_days ?? [],
      preferred_time_slots: mem?.preferred_time_slots ?? [],
    };
  }) ?? [];

  return NextResponse.json({ staff });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = createServerClient();

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 店舗オーナーであることを確認
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_user_id', user.id)
    .single();
  if (!store) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { lineUserId, ...updateData } = await request.json();
  if (!lineUserId) return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('user_stores')
    .update(updateData)
    .eq('user_id', lineUserId)
    .eq('store_id', storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
