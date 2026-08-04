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

  // オーナーまたはマネージャーのみアクセス可
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (!store) {
    const { data: membership } = await supabase
      .from('user_stores')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
  const nameMap: Record<string, string> = {};

  if (prefUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('line_user_id, name')
      .in('line_user_id', prefUserIds);

    profiles?.forEach(p => {
      nameMap[p.line_user_id] = p.name || '不明';
    });
  }

  const enriched = (prefs ?? []).map(p => ({
    ...p,
    profiles: { name: nameMap[p.user_id] || '不明' },
  }));

  return NextResponse.json({ preferences: enriched });
}
