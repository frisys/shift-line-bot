import { NextRequest } from 'next/server';
import { GET } from '@/app/api/stores/[id]/route';

jest.mock('@supabase/supabase-js', () => {
  const state = {
    memberResult: { data: { user_id: 'user-1' }, error: null } as unknown,
    storeResult:  { data: { id: 'store-1', name: 'テスト店' }, error: null } as unknown,
  };
  (global as { __storesIdState?: typeof state }).__storesIdState = state;

  return {
    createClient: jest.fn(() => ({
      from: jest.fn((table: string) => {
        if (table === 'user_stores') {
          return {
            select: jest.fn().mockReturnThis(),
            eq:     jest.fn().mockReturnThis(),
            maybeSingle: () => Promise.resolve(state.memberResult),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: () => Promise.resolve(state.storeResult),
        };
      }),
    })),
  };
});

const state = () => (global as { __storesIdState?: Record<string, unknown> }).__storesIdState!;

const STORE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID  = 'U_test_user_01';

function makeRequest(storeId: string, userId?: string) {
  const url = userId
    ? `http://localhost/api/stores/${storeId}?userId=${encodeURIComponent(userId)}`
    : `http://localhost/api/stores/${storeId}`;
  return new NextRequest(url);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  const s = state();
  s.memberResult = { data: { user_id: USER_ID }, error: null };
  s.storeResult  = { data: { id: STORE_ID, name: 'テスト店' }, error: null };
});

describe('GET /api/stores/[id]', () => {
  it('200: メンバーの userId でアクセス → id/name を返す', async () => {
    const res = await GET(makeRequest(STORE_ID, USER_ID), makeParams(STORE_ID));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.id).toBe(STORE_ID);
    expect(data.name).toBe('テスト店');
  });

  it('レスポンスに store_code が含まれない (回帰テスト)', async () => {
    const res = await GET(makeRequest(STORE_ID, USER_ID), makeParams(STORE_ID));
    const { data } = await res.json();
    expect(data).not.toHaveProperty('store_code');
  });

  it('400: userId 未指定', async () => {
    const res = await GET(makeRequest(STORE_ID), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('403: user_stores に存在しない userId', async () => {
    state().memberResult = { data: null, error: null };
    const res = await GET(makeRequest(STORE_ID, 'unknown-user'), makeParams(STORE_ID));
    expect(res.status).toBe(403);
  });

  it('404: membership は存在するが stores テーブルに該当なし', async () => {
    state().storeResult = { data: null, error: { message: 'no rows' } };
    const res = await GET(makeRequest(STORE_ID, USER_ID), makeParams(STORE_ID));
    expect(res.status).toBe(404);
  });
});
