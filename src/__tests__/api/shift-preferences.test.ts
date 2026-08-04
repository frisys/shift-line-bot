import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/shift-preferences/route';

// jest.mock はホイストされるため、ファクトリ内で状態オブジェクトを作成し global に露出する
jest.mock('@supabase/supabase-js', () => {
  const state = {
    maybeSingleResult: { data: { user_id: 'user-1' }, error: null } as unknown,
    orderResult:       { data: [], error: null } as unknown,
    upsertResult:      { data: [], error: null } as unknown,
  };
  (global as { __spState?: typeof state }).__spState = state;

  return {
    createClient: jest.fn(() => ({
      from: jest.fn((table: string) => {
        if (table === 'user_stores') {
          return {
            select: jest.fn().mockReturnThis(),
            eq:     jest.fn().mockReturnThis(),
            maybeSingle: () => Promise.resolve(state.maybeSingleResult),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          gte:    jest.fn().mockReturnThis(),
          lte:    jest.fn().mockReturnThis(),
          order:  () => Promise.resolve(state.orderResult),
          upsert: jest.fn(() => ({ select: () => Promise.resolve(state.upsertResult) })),
        };
      }),
    })),
  };
});

const state = () => (global as { __spState?: Record<string, unknown> }).__spState!;

const VALID_STORE_ID = '11111111-1111-1111-1111-111111111111';
const VALID_USER_ID = 'U1234567890abcdef';

function makePostRequest(preferences: unknown[]) {
  return new NextRequest('http://localhost/api/shift-preferences', {
    method: 'POST',
    body: JSON.stringify({ preferences }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeGetRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/shift-preferences');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

beforeEach(() => {
  const s = state();
  s.maybeSingleResult = { data: { user_id: VALID_USER_ID }, error: null };
  s.orderResult       = { data: [], error: null };
  s.upsertResult      = { data: [], error: null };
});

// ---------- POST ----------
describe('POST /api/shift-preferences', () => {
  it('200: 有効なリクエストを保存する', async () => {
    state().upsertResult = { data: [{}], error: null };
    const req = makePostRequest([{
      user_id: VALID_USER_ID, store_id: VALID_STORE_ID,
      shift_date: '2026-06-01', status: 'ok',
    }]);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('400: preferences が空配列', async () => {
    expect((await POST(makePostRequest([]))).status).toBe(400);
  });

  it('400: store_id が UUID でない', async () => {
    const res = await POST(makePostRequest([{
      user_id: VALID_USER_ID, store_id: 'not-a-uuid',
      shift_date: '2026-06-01', status: 'ok',
    }]));
    expect(res.status).toBe(400);
  });

  it('400: shift_date が YYYY-MM-DD でない', async () => {
    const res = await POST(makePostRequest([{
      user_id: VALID_USER_ID, store_id: VALID_STORE_ID,
      shift_date: '2026/06/01', status: 'ok',
    }]));
    expect(res.status).toBe(400);
  });

  it('400: status が無効値', async () => {
    const res = await POST(makePostRequest([{
      user_id: VALID_USER_ID, store_id: VALID_STORE_ID,
      shift_date: '2026-06-01', status: 'invalid',
    }]));
    expect(res.status).toBe(400);
  });

  it('400: time_slot が 50 文字超', async () => {
    const res = await POST(makePostRequest([{
      user_id: VALID_USER_ID, store_id: VALID_STORE_ID,
      shift_date: '2026-06-01', status: 'ok', time_slot: 'a'.repeat(51),
    }]));
    expect(res.status).toBe(400);
  });

  it('403: 非メンバーの (user_id, store_id)', async () => {
    state().maybeSingleResult = { data: null, error: null };
    const res = await POST(makePostRequest([{
      user_id: VALID_USER_ID, store_id: VALID_STORE_ID,
      shift_date: '2026-06-01', status: 'ok',
    }]));
    expect(res.status).toBe(403);
  });

  it('403: 複数 preferences で 1 件が非メンバーなら 403', async () => {
    const OTHER_STORE = '22222222-2222-2222-2222-222222222222';
    state().maybeSingleResult = { data: null, error: null };

    const res = await POST(makePostRequest([
      { user_id: VALID_USER_ID, store_id: VALID_STORE_ID, shift_date: '2026-06-01', status: 'ok' },
      { user_id: VALID_USER_ID, store_id: OTHER_STORE,    shift_date: '2026-06-02', status: 'ok' },
    ]));
    expect(res.status).toBe(403);
  });
});

// ---------- GET ----------
describe('GET /api/shift-preferences', () => {
  it('200: 有効な userId/storeId でデータを取得', async () => {
    state().orderResult = { data: [{ shift_date: '2026-06-01', status: 'ok', time_slot: null }], error: null };
    const res = await GET(makeGetRequest({ userId: VALID_USER_ID, storeId: VALID_STORE_ID }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  it('200: year/month フィルタ付き', async () => {
    const res = await GET(makeGetRequest({
      userId: VALID_USER_ID, storeId: VALID_STORE_ID, year: '2026', month: '6',
    }));
    expect(res.status).toBe(200);
  });

  it('400: userId 未指定', async () => {
    expect((await GET(makeGetRequest({ storeId: VALID_STORE_ID }))).status).toBe(400);
  });

  it('400: storeId が UUID でない', async () => {
    expect((await GET(makeGetRequest({ userId: VALID_USER_ID, storeId: 'bad-id' }))).status).toBe(400);
  });

  it('403: 非メンバーの userId', async () => {
    state().maybeSingleResult = { data: null, error: null };
    expect((await GET(makeGetRequest({ userId: VALID_USER_ID, storeId: VALID_STORE_ID }))).status).toBe(403);
  });

  it('400: month が範囲外 (month=13)', async () => {
    const res = await GET(makeGetRequest({
      userId: VALID_USER_ID, storeId: VALID_STORE_ID, year: '2026', month: '13',
    }));
    expect(res.status).toBe(400);
  });

  it('400: year が範囲外 (year=1999)', async () => {
    const res = await GET(makeGetRequest({
      userId: VALID_USER_ID, storeId: VALID_STORE_ID, year: '1999', month: '6',
    }));
    expect(res.status).toBe(400);
  });
});
