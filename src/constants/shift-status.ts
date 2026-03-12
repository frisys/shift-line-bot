// シフト希望ステータス定義
export const SHIFT_STATUS = {
  OK: 'ok',
  MAYBE: 'maybe',
  NO: 'no',
} as const;

export type ShiftStatus = (typeof SHIFT_STATUS)[keyof typeof SHIFT_STATUS];

// ステータスの日本語表示名
export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  ok: '◯ 出勤可',
  maybe: '△ 微妙',
  no: '× 休み',
};
