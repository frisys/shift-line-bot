import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: 店舗情報を取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: '店舗IDが指定されていません' },
        { status: 400 }
      );
    }

    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId は必須です' }, { status: 400 });
    }

    // ユーザーが店舗に所属しているか検証
    const { data: membership } = await supabase
      .from('user_stores')
      .select('user_id')
      .eq('user_id', userId)
      .eq('store_id', id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'この店舗へのアクセス権限がありません' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: '店舗が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('APIエラー:', err);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
