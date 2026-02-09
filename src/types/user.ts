export interface User {
  id: string;
  email: string | null | undefined;
  // 必要に応じて追加: email_confirmed_at, created_at など
}