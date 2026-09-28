# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリで作業する際のガイドです。
VisualStudioCodeはClaude Codeが操作を完了したのちにその出力をレビューします。

## プロジェクト概要

**shift-line-bot** はLINEと連携したスタッフシフト管理システムです。
- スタッフ: LINE Botでシフト希望を提出
- 店長: Webダッシュボードでシフト希望を確認・管理

**技術スタック:** Next.js 16 / TypeScript / Supabase / LINE Bot SDK / Tailwind CSS 4

## 開発コマンド

```bash
npm install      # 依存関係インストール
npm run dev      # 開発サーバー起動 (ポート3000)
npm run build    # 本番ビルド
npm run lint     # ESLintチェック
```

## フォルダ構成

```
src/
├── app/                    # Next.js App Router (ページ・API)
│   ├── api/line/webhook/   # LINE Webhook (署名検証、イベント処理)
│   ├── dashboard/          # 店長用ダッシュボード
│   │   └── components/     # ダッシュボード専用コンポーネント
│   ├── login/              # ログインページ
│   └── providers/          # Reactコンテキスト
├── constants/              # 定数・Enum型
│   ├── roles.ts            # スタッフ役割 (manager/staff/admin)
│   ├── shift-status.ts     # シフト希望状態 (ok/maybe/no)
│   └── weekdays.ts         # 曜日マッピング (mon→月)
├── hooks/                  # カスタムフック
│   └── useDashboardData.ts # ダッシュボードのデータ取得
├── services/               # データアクセス層 (Supabase操作)
│   ├── staff.service.ts    # スタッフ更新
│   └── store.service.ts    # 店舗更新
├── types/                  # 型定義
│   ├── auth.ts             # 認証コンテキスト型
│   ├── staff.ts            # Staff型
│   ├── store.ts            # Store型
│   └── shift-preference.ts # ShiftPreference型
├── utils/                  # ユーティリティ関数
│   └── date.ts             # 日付処理 (週開始日取得など)
└── lib/supabase/           # Supabaseクライアント設定
```

## 設計パターン

### サービス層
コンポーネントから直接Supabaseを呼ばず、`services/`経由でDB操作を行う。

```typescript
// 良い例
import { updateStaffProfile } from '@/services';
await updateStaffProfile(id, { name: '田中' });

// 避けるべき例
await supabase.from('profiles').update({ name: '田中' }).eq('id', id);
```

### 型定義
`constants/`で厳密な型を定義し、`types/`で使用する。

```typescript
// constants/roles.ts
export type StaffRole = 'manager' | 'staff' | 'admin';

// types/staff.ts
import type { StaffRole } from '@/constants';
export interface Staff { role: StaffRole; ... }
```

## LINE Bot処理フロー

Webhookエンドポイント: `/api/line/webhook`

| イベント | 処理内容 |
|---------|---------|
| `follow` | 友達追加 → `profiles`にユーザー登録、リッチメニュー作成 |
| `message` | 店舗コード入力 (4-10文字の英数字) → 店舗に紐づけ |
| `postback` | シフト希望提出フロー (日付選択→状態選択→時間帯選択→保存) |

## データベース (Supabase)

| テーブル | 用途 |
|---------|------|
| `profiles` | ユーザー情報 (`line_user_id`, `name`) |
| `stores` | 店舗情報 (`store_code`, `required_staff`) |
| `user_stores` | ユーザー×店舗の紐づけ (`role`, 勤務制約) |
| `shift_preferences` | シフト希望 (`shift_date`, `status`, `time_slot`) |

## デプロイ

AWS Amplify Hosting（Next.js SSR compute）を使用。Vercel想定で書かれていた箇所は
順次Amplify向けに修正済み。ビルド設定は`amplify.yml`、詳細な移行注意点・環境変数の
設定方法は[docs/AMPLIFY_DEPLOY.md](./docs/AMPLIFY_DEPLOY.md)を参照。

## 環境変数

`.env`ファイルに設定（Git管理外、ローカル開発用）:

```
LINE_CHANNEL_SECRET          # LINE署名検証用 (サーバー専用)
LINE_CHANNEL_ACCESS_TOKEN    # LINE Messaging API用 (サーバー専用)
NEXT_PUBLIC_SUPABASE_URL     # SupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase匿名キー
NEXT_PUBLIC_APP_URL          # デプロイ先のURL（リッチメニュー画像取得・ヘルプリンクに使用）
SUPABASE_SERVICE_ROLE_KEY    # Supabaseサービスロールキー (サーバー専用)
OPTIMIZE_LAMBDA_ARN          # シフト最適化Lambda のARN（IAM Invoke、シークレットではない）
```

サーバー専用の値（上記「サーバー専用」と注記したもの）は`src/lib/secrets/server-secrets.ts`の
`getServerSecret()`経由で取得する。ローカルでは`.env`の値をそのまま使い、AWS Amplify本番環境では
`.env`に値を置かず、AWS Systems Manager Parameter Store (SecureString) から実行時に取得する。
詳細は[docs/AMPLIFY_DEPLOY.md](./docs/AMPLIFY_DEPLOY.md)。

## TypeScript設定

- パスエイリアス: `@/*` → `./src/*`
- React Compiler有効 (`next.config.ts`)
- Strictモード有効
