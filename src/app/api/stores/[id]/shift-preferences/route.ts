import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate と endDate は必須です' }, { status: 400 });
  }

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // オーナーまたはマネージャー/管理者のみアクセス可
  const [ownerResult, membershipResult] = await Promise.all([
    supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('owner_user_id', user.id)
      .maybeSingle(),
    supabase
      .from('user_stores')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const isOwner = !!ownerResult.data;
  const isManager = membershipResult.data?.role === 'manager' || membershipResult.data?.role === 'admin';

  if (!isOwner && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: prefs, error: prefsError } = await supabase
    .from('shift_preferences')
    .select('*')
    .eq('store_id', storeId)
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);

  if (prefsError) {
    return NextResponse.json({ error: prefsError.message }, { status: 500 });
  }

  const prefUserIds = [...new Set((prefs ?? []).map(p => p.user_id))];

  // 役割が管理者(admin)のユーザーはシフト希望・作成対象から除外する
  const adminUserIds = new Set<string>();
  if (prefUserIds.length > 0) {
    const { data: memberships } = await supabase
      .from('user_stores')
      .select('user_id, role')
      .eq('store_id', storeId)
      .in('user_id', prefUserIds);

    memberships?.forEach(m => {
      if (m.role === 'admin') adminUserIds.add(m.user_id);
    });
  }

  const visiblePrefs = (prefs ?? []).filter(p => !adminUserIds.has(p.user_id));

  const nameMap: Record<string, string> = {};
  const visibleUserIds = [...new Set(visiblePrefs.map(p => p.user_id))];

  if (visibleUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('line_user_id, name')
      .in('line_user_id', visibleUserIds);

    profiles?.forEach(p => {
      nameMap[p.line_user_id] = p.name || '不明';
    });
  }

  const enriched = visiblePrefs.map(p => ({
    ...p,
    profiles: { name: nameMap[p.user_id] || '不明' },
  }));

  return NextResponse.json({ preferences: enriched });
}
