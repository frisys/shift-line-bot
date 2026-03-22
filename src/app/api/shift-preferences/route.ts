import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ShiftPreferenceInput {
  user_id: string;
  store_id: string;
  shift_date: string;
  status: 'ok' | 'maybe' | 'no';
  time_slot?: string | null;
}

// POST: シフト希望を保存
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preferences } = body as { preferences: ShiftPreferenceInput[] };

    if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
      return NextResponse.json(
        { error: 'シフト希望が指定されていません' },
        { status: 400 }
      );
    }

    // バリデーション
    for (const pref of preferences) {
      if (!pref.user_id || !pref.store_id || !pref.shift_date || !pref.status) {
        return NextResponse.json(
          { error: '必須項目が不足しています' },
          { status: 400 }
        );
      }
      if (!['ok', 'maybe', 'no'].includes(pref.status)) {
        return NextResponse.json(
          { error: '無効なステータスです' },
          { status: 400 }
        );
      }
    }

    // upsert実行
    const { data, error } = await supabase
      .from('shift_preferences')
      .upsert(
        preferences.map((p) => ({
          user_id: p.user_id,
          store_id: p.store_id,
          shift_date: p.shift_date,
          status: p.status,
          time_slot: p.time_slot || null,
        })),
        { onConflict: 'user_id,store_id,shift_date' }
      )
      .select();

    if (error) {
      console.error('シフト希望保存エラー:', error);
      return NextResponse.json(
        { error: '保存に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('APIエラー:', err);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// GET: シフト希望を取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const storeId = searchParams.get('storeId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!userId || !storeId) {
      return NextResponse.json(
        { error: 'userId と storeId は必須です' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('shift_preferences')
      .select('shift_date, status, time_slot')
      .eq('user_id', userId)
      .eq('store_id', storeId);

    // 年月指定がある場合は範囲フィルタ
    if (year && month) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
      query = query.gte('shift_date', startDate).lte('shift_date', endDate);
    }

    const { data, error } = await query.order('shift_date', { ascending: true });

    if (error) {
      console.error('シフト希望取得エラー:', error);
      return NextResponse.json(
        { error: '取得に失敗しました' },
        { status: 500 }
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
