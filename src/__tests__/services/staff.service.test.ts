import { updateStaffProfile, createStaff, updateStaffStoreSettings } from '@/services/staff.service';

// supabase クライアントをモック
const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom: jest.Mock = jest.fn(() => ({ update: mockUpdate }));
const mockGetSession = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    auth: { getSession: () => mockGetSession() },
  },
}));

describe('updateStaffProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('profiles テーブルに update + eq を呼ぶ', async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateStaffProfile('staff-id-1', { display_name: '田中太郎' });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({ display_name: '田中太郎' });
    expect(mockEq).toHaveBeenCalledWith('id', 'staff-id-1');
  });

  it('Supabase がエラーを返した場合そのまま返却する', async () => {
    const dbError = { message: 'DB error' };
    mockEq.mockResolvedValue({ error: dbError });
    const result = await updateStaffProfile('staff-id-1', { display_name: '田中太郎' });
    expect(result).toEqual({ error: dbError });
  });
});

describe('createStaff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
  });

  it('セッションがない場合は error を返す', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await createStaff('store-id', { name: 'テスト' });
    expect(result.staff).toBeNull();
    expect(result.error?.message).toBe('Not authenticated');
  });

  it('POST /api/stores/:id/staff を Bearer トークン付きで呼ぶ', async () => {
    const mockStaff = { id: 'new-id', name: 'テスト', role: 'staff' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ staff: mockStaff }),
    } as Response);

    const result = await createStaff('store-abc', { name: 'テスト' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stores/store-abc/staff',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    expect(result.staff).toEqual(mockStaff);
    expect(result.error).toBeNull();
  });

  it('レスポンスが ok でない場合は error を返す', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response);

    const result = await createStaff('store-abc', { name: 'テスト' });
    expect(result.staff).toBeNull();
    expect(result.error?.message).toBe('Server error');
  });
});

describe('updateStaffStoreSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
  });

  it('セッションがない場合は error を返す', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await updateStaffStoreSettings('line-user-1', 'store-1', { role: 'staff' });
    expect(result.error?.message).toBe('Not authenticated');
  });

  it('PATCH /api/stores/:id/staff を body に lineUserId を含めて呼ぶ', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await updateStaffStoreSettings('line-user-1', 'store-abc', { role: 'manager', max_weekly_days: 5 });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stores/store-abc/staff',
      expect.objectContaining({ method: 'PATCH' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.lineUserId).toBe('line-user-1');
    expect(body.role).toBe('manager');
    expect(body.max_weekly_days).toBe(5);
  });

  it('レスポンスが ok でない場合は error を返す', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: '無効な role です' }),
    } as Response);

    const result = await updateStaffStoreSettings('line-user-1', 'store-abc', { role: 'unknown' as 'staff' });
    expect(result.error?.message).toBe('無効な role です');
  });
});
