// スタッフの役割定義
export const STAFF_ROLES = {
  MANAGER: 'manager',
  STAFF: 'staff',
  ADMIN: 'admin',
} as const;

export type StaffRole = (typeof STAFF_ROLES)[keyof typeof STAFF_ROLES];

// 役割の日本語表示名
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  manager: '店長',
  staff: 'スタッフ',
  admin: '管理者',
};
