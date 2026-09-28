# AWS Amplify Hosting デプロイ手順

このプロジェクトは元々Vercelを想定して実装されていましたが、AWS Amplify Hosting
（Next.js SSR向けのcompute）へ移行しました。デプロイ前に以下を確認してください。

## 1. Next.js バージョンについて（要注意）

AWS Amplify Hostingが公式にサポートするNext.jsは **バージョン12〜15** です
（[Amplify support for Next.js](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)）。
本プロジェクトは **Next.js 16.1.6** を使用しており、これは公式サポート範囲外です。

- App Routerの実行モデル自体はv15から大きく変わっていないため動作する可能性は高いですが、
  **初回デプロイ後は必ず本番相当の動作確認（LINE Webhook・ダッシュボードAPI一通り）を行ってください。**
- Amplify Hostingでの既知の未サポート機能: Edge API Routes / Edge Middleware、
  On-Demand ISR、Next.js streaming、`unstable_after`。本プロジェクトはこれらを使用していません。

## 2. シークレットの扱い方（Vercelとの最大の違い）

VercelはダッシュボードのEnvironment Variablesをそのままサーバーレス関数の`process.env`に
注入しますが、**Amplify Hostingではビルド時に明示的に`.env.production`へ書き出した変数しか
実行時に参照できません**。さらにAWSは「ビルド成果物に機密情報を含めない」ことを強く推奨しています
（[Making environment variables accessible to server-side runtimes](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html)）。

そのため本プロジェクトでは以下のように役割を分けています。

| 種別 | 扱い方 | 該当変数 |
|---|---|---|
| 公開してよい値（`NEXT_PUBLIC_*`）・非機密設定 | `amplify.yml`が`.env.production`へ書き出す | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_APP_URL`, `APP_ENV`, `TZ`, `OPTIMIZE_LAMBDA_ARN` |
| サーバー専用シークレット | ビルド成果物に含めず、実行時に AWS Systems Manager Parameter Store (SecureString) から取得（`src/lib/secrets/server-secrets.ts`） | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` |

`OPTIMIZE_LAMBDA_ARN`はシークレットではなくLambda関数のARN（識別子）です。以前は
共有シークレット付きのURL(`OPTIMIZE_LAMBDA_URL`/`OPTIMIZE_LAMBDA_SECRET`)経由でHTTP呼び出し
していましたが、シークレットを持たずAmplify Hosting compute roleのIAM権限だけで呼び出す方式
（`src/app/api/optimize/route.ts`が`@aws-sdk/client-lambda`で直接Invoke）に変更しました。

ローカル開発では従来どおり`.env`に直接値を書けば動作します
（`getServerSecret()`は`process.env`に値があればそれを優先し、なければSSMへフォールバックします）。

**注意**: `OPTIMIZE_LAMBDA_ARN`への変更により、ローカルで`/api/optimize`を叩く（＝シフト最適化を
実行する）にはローカル環境にAWS認証情報（`aws configure`やSSOログイン）が必要になりました。
以前のURL+シークレット方式では不要でしたが、IAM Invoke方式では開発者自身のAWS権限
（対象Lambdaへの`lambda:InvokeFunction`）で呼び出す形になります。

### 2-1. SSM Parameter Storeにシークレットを登録する

パラメータ名のデフォルトは `/shift-line-bot/<環境変数名>` です
（`<環境変数名>_SSM_PATH` というAmplify環境変数で個別に上書き可能）。

```bash
aws ssm put-parameter --name /shift-line-bot/LINE_CHANNEL_SECRET \
  --type SecureString --value "<LINEチャネルシークレット>"

aws ssm put-parameter --name /shift-line-bot/LINE_CHANNEL_ACCESS_TOKEN \
  --type SecureString --value "<LINEチャネルアクセストークン>"

aws ssm put-parameter --name /shift-line-bot/SUPABASE_SERVICE_ROLE_KEY \
  --type SecureString --value "<Supabase service_role key>"
```

### 2-2. Amplify Hosting compute roleにSSM読み取り権限を付与する

Amplifyの「SSR compute role」（[IAMロールの使用](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-SSR-compute-role.html)）に、
以下のようなインラインポリシーをアタッチしてください（`<region>` / `<account-id>` は環境に置き換え）。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter"],
      "Resource": "arn:aws:ssm:<region>:<account-id>:parameter/shift-line-bot/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "<alias/aws/ssm の実際のキーARN。aws kms describe-key --key-id alias/aws/ssm で取得>"
    }
  ]
}
```

`alias/aws/ssm`はエイリアス名であり、IAMポリシーのResourceにはエイリアスではなく実際のキーARN
（`arn:aws:kms:<region>:<account-id>:key/<key-id>`の形式）を指定する必要があります。
`aws kms describe-key --key-id alias/aws/ssm --query KeyMetadata.Arn --output text`で取得できます
（下記のコピペ用コマンドではこれを自動で解決しています）。
SecureStringをデフォルトのAWS管理キーではなくカスタムKMSキーで暗号化した場合は、そのキーのARNを使ってください。

### 2-3. 最適化Lambdaを呼び出すためのIAM権限

シフト最適化Lambdaはシークレット付きURLではなく、`@aws-sdk/client-lambda`によるARN直接Invoke
方式に変更しています。同じ「SSR compute role」に、対象Lambda関数のARNを指定した
`lambda:InvokeFunction`権限を追加してください。

```json
{
  "Effect": "Allow",
  "Action": ["lambda:InvokeFunction"],
  "Resource": "arn:aws:lambda:<region>:<account-id>:function:<最適化Lambdaの関数名>"
}
```

現時点ではこのbot専用のLambdaですが、将来的に他のAWS上のbot/システムから呼ばれる場合も、
呼び出し元それぞれのIAMロールに同じ`lambda:InvokeFunction`権限を個別に付与すればよく、
シークレットの配布・ローテーションは不要です。

**レスポンス形式についての注意**: `src/app/api/optimize/route.ts`は、Lambdaの戻り値が
API Gateway/Function URLプロキシ形式（`{statusCode, body}`）と素のJSONの両方に対応できる
ようにしていますが、実際にどちらの形式で返ってくるかはLambda側の実装次第です。
**初回デプロイ後、シフト最適化を実際に実行してレスポンスが正しく返ることを確認してください。**

### 2-4. まとめてコピペで実行する（CloudShell想定）

上記2-1〜2-3を一括で行うスクリプト例です。冒頭の変数（`AWS_REGION` / `AMPLIFY_APP_ID` /
`LAMBDA_FUNCTION_ARN` / シークレットの値）だけ環境に合わせて書き換えてから、CloudShellに
貼り付けて実行してください。

`AMPLIFY_APP_ID`が分からない場合は先にこれで確認できます。

```bash
aws amplify list-apps --query "apps[].{name:name,appId:appId}" --output table
```

`LAMBDA_FUNCTION_ARN`が分からない場合はこれで確認できます。

```bash
aws lambda list-functions --query "Functions[].{name:FunctionName,arn:FunctionArn}" --output table
```

既にSSR compute roleを作成済みの場合は、下記スクリプトの「IAMロール作成」部分は
スキップして`SSR_ROLE_NAME`を既存のロール名に置き換えてください。

```bash
# ====== ここを環境に合わせて書き換える ======
AWS_REGION="ap-northeast-1"
AMPLIFY_APP_ID="xxxxxxxxxxxxx"
LAMBDA_FUNCTION_ARN="arn:aws:lambda:${AWS_REGION}:<account-id>:function:<最適化Lambdaの関数名>"
SSR_ROLE_NAME="shift-line-bot-ssr-compute-role"

LINE_CHANNEL_SECRET_VALUE="<LINEチャネルシークレット>"
LINE_CHANNEL_ACCESS_TOKEN_VALUE="<LINEチャネルアクセストークン>"
SUPABASE_SERVICE_ROLE_KEY_VALUE="<Supabase service_role key>"
# ============================================

set -e
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
KMS_KEY_ARN=$(aws kms describe-key --key-id alias/aws/ssm --region "$AWS_REGION" \
  --query KeyMetadata.Arn --output text)

# 1. シークレットをSSM Parameter Storeに登録
aws ssm put-parameter --region "$AWS_REGION" \
  --name /shift-line-bot/LINE_CHANNEL_SECRET \
  --type SecureString --value "$LINE_CHANNEL_SECRET_VALUE" --overwrite

aws ssm put-parameter --region "$AWS_REGION" \
  --name /shift-line-bot/LINE_CHANNEL_ACCESS_TOKEN \
  --type SecureString --value "$LINE_CHANNEL_ACCESS_TOKEN_VALUE" --overwrite

aws ssm put-parameter --region "$AWS_REGION" \
  --name /shift-line-bot/SUPABASE_SERVICE_ROLE_KEY \
  --type SecureString --value "$SUPABASE_SERVICE_ROLE_KEY_VALUE" --overwrite

# 2. SSR compute role を作成（未作成の場合のみ）
cat > /tmp/trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": ["amplify.amazonaws.com"] },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam get-role --role-name "$SSR_ROLE_NAME" >/dev/null 2>&1 || \
  aws iam create-role \
    --role-name "$SSR_ROLE_NAME" \
    --assume-role-policy-document file:///tmp/trust-policy.json

# 3. SSM読み取り + Lambda呼び出しの権限をロールに付与
cat > /tmp/ssr-permissions.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter"],
      "Resource": "arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter/shift-line-bot/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "${KMS_KEY_ARN}"
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction"],
      "Resource": "${LAMBDA_FUNCTION_ARN}"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$SSR_ROLE_NAME" \
  --policy-name shift-line-bot-ssr-permissions \
  --policy-document file:///tmp/ssr-permissions.json

# 4. このロールをAmplifyアプリのCompute roleとして紐付け
ROLE_ARN=$(aws iam get-role --role-name "$SSR_ROLE_NAME" --query 'Role.Arn' --output text)

aws amplify update-app \
  --app-id "$AMPLIFY_APP_ID" \
  --compute-role-arn "$ROLE_ARN"

echo "完了: Compute role = $ROLE_ARN"
```

実行後、Amplifyコンソールの「App settings → IAM roles」でCompute roleに
`$SSR_ROLE_NAME`が設定されていることを確認してください。

## 3. Amplifyコンソールで設定する環境変数

App settings → Environment variables に以下を設定してください（これらは`amplify.yml`が
`.env.production`へ転記します。機密情報ではありません）。

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
NEXT_PUBLIC_APP_URL        # 例: https://xxxxxxxx.amplifyapp.com （独自ドメイン運用ならそのURL）
APP_ENV
TZ
OPTIMIZE_LAMBDA_ARN        # 例: arn:aws:lambda:<region>:<account-id>:function:<関数名>
```

`LINE_CHANNEL_SECRET`などのサーバー専用シークレットは、Amplifyコンソールの環境変数には**設定しないでください**
（設定してしまうとビルド成果物には含まれませんが無意味なので、SSM Parameter Store側のみで管理します）。

## 4. LINEリッチメニュー画像について

AWS Amplify Hosting computeは`public/`配下のファイルをLambdaのローカルファイルシステムには
含めません（CloudFront/S3経由で配信されます）。そのため`src/app/api/line/webhook/route.ts`の
リッチメニュー画像取得は、`fs.readFile`ではなく`${NEXT_PUBLIC_APP_URL}/rich-menu.png`への
HTTP取得に変更してあります。**`NEXT_PUBLIC_APP_URL`が実際にデプロイ済みのドメインを指している
必要があります**（友だち追加イベントの処理時点でアプリ自身が既に公開されている前提）。

## 5. 削除したデバッグ用エンドポイント

移行時のレビューで以下の未認証デバッグエンドポイントを発見し削除しました。
`LINE_CHANNEL_SECRET`・`LINE_CHANNEL_ACCESS_TOKEN`を含む全環境変数をJSONで返す、
または`stores`テーブルを無認証でダンプするものだったため、プラットフォームに関わらず
セキュリティ上のリスクでした。

- `src/app/api/test-date/route.ts`
- `src/app/test/page.tsx`
