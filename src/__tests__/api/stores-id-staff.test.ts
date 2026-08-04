import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/stores/[id]/staff/route';

const STORE_ID = 'store-0000-0000-0000-000000000001';
const OWNER_ID = 'owner-user-uuid-0001';
const LINE_USER_ID = 'Uline00000000001';
const TOKEN = 'test-bearer-token';

// createServerClient が返すモック
const mockGetUser = jest.fn();
const mockUpdateEq2 = jest.fn();
const mockUpdateEq1 = jest.fn(() => ({ eq: mockUpdateEq2 }));
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq1 }));
const mockStoreSingle = jest.fn();

const mockAdminFrom = jest.fn((table: string) => {
  if (table === 'stores') {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: mockStoreSingle,
    };
  }
  return { update: mockUpdate };
});

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockAdminFrom,
  })),
}));

function makePatchRequest(body: Record<string, unknown>, token?: string) {
  return new NextRequest(`http://localhost/api/stores/${STORE_ID}/staff`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null });
  mockStoreSingle.mockResolvedValue({ data: { id: STORE_ID }, error: null });
  mockUpdateEq2.mockResolvedValue({ error: null });
});

describe('PATCH /api/stores/[id]/staff', () => {
  it('401: Authorization ヘッダーなし', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, role: 'staff' }), makeParams(STORE_ID));
    expect(res.status).toBe(401);
  });

  it('401: 無効なトークン', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, role: 'staff' }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(401);
  });

  it('403: オーナーでない店舗', async () => {
    mockStoreSingle.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, role: 'staff' }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(403);
  });

  it('400: lineUserId 未指定', async () => {
    const res = await PATCH(makePatchRequest({ role: 'staff' }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('200: 許可フィールド (role) のみの更新', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, role: 'manager' }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ role: 'manager' }));
  });

  it('200: 複数許可フィールドを更新', async () => {
    const res = await PATCH(makePatchRequest({
      lineUserId: LINE_USER_ID,
      max_consecutive_days: 3,
      max_weekly_days: 5,
      hourly_wage: 1200,
    }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      max_consecutive_days: 3,
      max_weekly_days: 5,
      hourly_wage: 1200,
    }));
  });

  it('400: role に無効値', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, role: 'superadmin' }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('400: max_consecutive_days に負の整数', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, max_consecutive_days: -1 }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('400: preferred_time_slots が文字列配列でない', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, preferred_time_slots: [1, 2, 3] }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('400: hourly_wage が負値', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, hourly_wage: -500 }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('400: 更新フィールドなし (lineUserId のみ)', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('400: 未知フィールドのみ (ホワイトリスト外は更新フィールドと認識されない)', async () => {
    const res = await PATCH(makePatchRequest({ lineUserId: LINE_USER_ID, admin_override: true }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(400);
  });

  it('未知フィールド + 許可フィールド → update に未知フィールドが含まれない', async () => {
    const res = await PATCH(makePatchRequest({
      lineUserId: LINE_USER_ID,
      role: 'staff',
      admin_override: true,
    }, TOKEN), makeParams(STORE_ID));
    expect(res.status).toBe(200);
    const updateArg = (mockUpdate.mock.calls as Record<string, unknown>[][])[0][0];
    expect(updateArg).not.toHaveProperty('admin_override');
    expect(updateArg).toHaveProperty('role', 'staff');
  });
});
