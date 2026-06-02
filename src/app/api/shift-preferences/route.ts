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

const VALID_STATUSES = new Set(['ok', 'maybe', 'no']);
const SHIFT_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isMember(userId: string, storeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_stores')
    .select('user_id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .maybeSingle();
  return data !== null;
}

// POST: シフト希望を保存
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preferences } = body as { preferences: ShiftPreferenceInput[] };

    if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
      return NextResponse.json({ error: 'シフト希望が指定されていません' }, { status: 400 });
    }

    for (const pref of preferences) {
      if (!pref.user_id || !pref.store_id || !pref.shift_date || !pref.status) {
        return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
      }
      if (!UUID_RE.test(pref.store_id)) {
        return NextResponse.json({ error: '無効な store_id です' }, { status: 400 });
      }
      if (!SHIFT_DATE_RE.test(pref.shift_date)) {
        return NextResponse.json({ error: '無効な shift_date 形式です (YYYY-MM-DD)' }, { status: 400 });
      }
      if (!VALID_STATUSES.has(pref.status)) {
        return NextResponse.json({ error: '無効なステータスです' }, { status: 400 });
      }
      if (pref.time_slot != null && (typeof pref.time_slot !== 'string' || pref.time_slot.length > 50)) {
        return NextResponse.json({ error: '無効な time_slot です' }, { status: 400 });
      }
    }

    // (user_id, store_id) の組み合わせごとに所属確認
    const combos = [...new Set(preferences.map(p => `${p.user_id}|${p.store_id}`))];
    for (const combo of combos) {
      const [userId, storeId] = combo.split('|');
      if (!(await isMember(userId, storeId))) {
        return NextResponse.json({ error: 'この店舗へのアクセス権限がありません' }, { status: 403 });
      }
    }

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
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('APIエラー:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
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
      return NextResponse.json({ error: 'userId と storeId は必須です' }, { status: 400 });
    }

    if (!UUID_RE.test(storeId)) {
      return NextResponse.json({ error: '無効な storeId です' }, { status: 400 });
    }

    if (!(await isMember(userId, storeId))) {
      return NextResponse.json({ error: 'この店舗へのアクセス権限がありません' }, { status: 403 });
    }

    let yearNum: number | undefined;
    let monthNum: number | undefined;
    if (year || month) {
      yearNum = parseInt(year ?? '', 10);
      monthNum = parseInt(month ?? '', 10);
      if (
        isNaN(yearNum) || isNaN(monthNum) ||
        yearNum < 2000 || yearNum > 2100 ||
        monthNum < 1 || monthNum > 12
      ) {
        return NextResponse.json({ error: '無効な year/month です' }, { status: 400 });
      }
    }

    let query = supabase
      .from('shift_preferences')
      .select('shift_date, status, time_slot')
      .eq('user_id', userId)
      .eq('store_id', storeId);

    if (yearNum !== undefined && monthNum !== undefined) {
      const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
      query = query.gte('shift_date', startDate).lte('shift_date', endDate);
    }

    const { data, error } = await query.order('shift_date', { ascending: true });

    if (error) {
      console.error('シフト希望取得エラー:', error);
      return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('APIエラー:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
