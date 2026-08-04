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
    .select('user_id, role, max_consecutive_days, max_weekly_days, unavailable_days, preferred_time_slots, hourly_wage')
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
    .select('id, name, display_name, line_user_id')
    .in('line_user_id', lineUserIds);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const staff = profilesData?.map(p => {
    const mem = memberships?.find(m => m.user_id === p.line_user_id);
    return {
      id: p.id,
      name: p.name,
      display_name: (p as { display_name?: string | null }).display_name ?? null,
      role: mem?.role ?? 'staff',
      store_id: storeId,
      line_user_id: p.line_user_id ?? '',
      max_consecutive_days: mem?.max_consecutive_days ?? 5,
      max_weekly_days: mem?.max_weekly_days ?? 5,
      unavailable_days: mem?.unavailable_days ?? [],
      preferred_time_slots: mem?.preferred_time_slots ?? [],
      hourly_wage: mem?.hourly_wage ?? null,
    };
  }) ?? [];

  return NextResponse.json({ staff });
}

export async function POST(
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

  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_user_id', user.id)
    .single();
  if (!store) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, role, max_consecutive_days, max_weekly_days, unavailable_days, preferred_time_slots, hourly_wage } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const { randomUUID } = await import('crypto');
  const placeholderLineUserId = `manual_${randomUUID()}`;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ name: name.trim(), line_user_id: placeholderLineUserId })
    .select('id')
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: profileError?.message ?? 'Failed to create profile' }, { status: 500 });
  }

  const { error: memberError } = await supabaseAdmin
    .from('user_stores')
    .insert({
      user_id: placeholderLineUserId,
      store_id: storeId,
      role: role ?? 'staff',
      max_consecutive_days: max_consecutive_days ?? null,
      max_weekly_days: max_weekly_days ?? null,
      unavailable_days: unavailable_days ?? [],
      preferred_time_slots: preferred_time_slots ?? [],
      hourly_wage: hourly_wage ?? null,
    });

  if (memberError) {
    await supabaseAdmin.from('profiles').delete().eq('id', profile.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({
    staff: {
      id: profile.id,
      name: name.trim(),
      role: role ?? 'staff',
      store_id: storeId,
      line_user_id: placeholderLineUserId,
      max_consecutive_days: max_consecutive_days ?? null,
      max_weekly_days: max_weekly_days ?? null,
      unavailable_days: unavailable_days ?? [],
      preferred_time_slots: preferred_time_slots ?? [],
      hourly_wage: hourly_wage ?? null,
    },
  });
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

  const body = await request.json();
  const { lineUserId } = body;
  if (!lineUserId) return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 });

  const VALID_ROLES = new Set(['manager', 'staff', 'admin']);
  const isNullablePositiveInt = (v: unknown) => v === null || (Number.isInteger(v) && (v as number) > 0);
  const isStringArray = (v: unknown) => Array.isArray(v) && (v as unknown[]).every(i => typeof i === 'string');

  type UpdateData = {
    role?: string;
    max_consecutive_days?: number | null;
    max_weekly_days?: number | null;
    unavailable_days?: string[];
    preferred_time_slots?: string[];
    hourly_wage?: number | null;
  };
  const updateData: UpdateData = {};

  if ('role' in body) {
    if (!VALID_ROLES.has(body.role)) return NextResponse.json({ error: '無効な role です' }, { status: 400 });
    updateData.role = body.role;
  }
  if ('max_consecutive_days' in body) {
    if (!isNullablePositiveInt(body.max_consecutive_days)) return NextResponse.json({ error: 'max_consecutive_days は正の整数または null にしてください' }, { status: 400 });
    updateData.max_consecutive_days = body.max_consecutive_days;
  }
  if ('max_weekly_days' in body) {
    if (!isNullablePositiveInt(body.max_weekly_days)) return NextResponse.json({ error: 'max_weekly_days は正の整数または null にしてください' }, { status: 400 });
    updateData.max_weekly_days = body.max_weekly_days;
  }
  if ('unavailable_days' in body) {
    if (!isStringArray(body.unavailable_days)) return NextResponse.json({ error: 'unavailable_days は文字列配列にしてください' }, { status: 400 });
    updateData.unavailable_days = body.unavailable_days;
  }
  if ('preferred_time_slots' in body) {
    if (!isStringArray(body.preferred_time_slots)) return NextResponse.json({ error: 'preferred_time_slots は文字列配列にしてください' }, { status: 400 });
    updateData.preferred_time_slots = body.preferred_time_slots;
  }
  if ('hourly_wage' in body) {
    if (body.hourly_wage !== null && (typeof body.hourly_wage !== 'number' || body.hourly_wage < 0)) {
      return NextResponse.json({ error: 'hourly_wage は 0 以上の数値または null にしてください' }, { status: 400 });
    }
    updateData.hourly_wage = body.hourly_wage;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('user_stores')
    .update(updateData)
    .eq('user_id', lineUserId)
    .eq('store_id', storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
