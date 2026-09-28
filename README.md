# shift-line-bot

LINEと連携したスタッフシフト管理システム。技術スタック等は[CLAUDE.md](./CLAUDE.md)を参照。

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npm test
```

## デプロイ

AWS Amplify Hosting（Next.js SSR compute）を使用。手順・注意点は
[docs/AMPLIFY_DEPLOY.md](./docs/AMPLIFY_DEPLOY.md)を参照。
