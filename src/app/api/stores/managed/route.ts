// src/app/api/stores/managed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createServerClient();

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('user_stores')
      .select('store_id')
      .eq('user_id', user.id)
      .eq('role', 'manager');

    if (memberError) {
      console.error('[stores/managed] memberships query failed', memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!memberships?.length) {
      return NextResponse.json({ stores: [] });
    }

    const storeIds = memberships.map((m) => m.store_id);
    const { data: stores, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .in('id', storeIds);

    if (storeError) {
      console.error('[stores/managed] stores query failed', storeError);
      return NextResponse.json({ error: storeError.message }, { status: 500 });
    }

    return NextResponse.json({ stores: stores ?? [] });
  } catch (error) {
    console.error('[stores/managed] unexpected error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}