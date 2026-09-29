import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Lambda ARN (arn:aws:lambda:<region>:<account-id>:function:<name>) からリージョンを抽出する。
// Amplify Hosting compute自体のリージョンとは異なる場合があるため、クライアントには
// このリージョンを明示的に指定する（未指定だとcomputeのリージョンが使われ、別リージョンの
// 関数を呼ぼうとして「見つからない」エラーになる）。
const ARN_REGION_RE = /^arn:aws:lambda:([a-z0-9-]+):/;

let lambdaClient: LambdaClient | null = null;
let lambdaClientRegion: string | undefined;

function getLambdaClient(region: string | undefined): LambdaClient {
  if (!lambdaClient || lambdaClientRegion !== region) {
    lambdaClient = new LambdaClient(region ? { region } : {});
    lambdaClientRegion = region;
  }
  return lambdaClient;
}

// Lambda Function URL / API Gateway プロキシ形式 ({statusCode, body}) を判定する
function isProxyStyleResponse(
  value: unknown
): value is { statusCode: number; body: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'body' in value &&
    typeof (value as { statusCode: unknown }).statusCode === 'number'
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'リクエストの形式が正しくありません' }, { status: 400 });
  }

  const functionArn = process.env.OPTIMIZE_LAMBDA_ARN;
  if (!functionArn) {
    console.error('OPTIMIZE_LAMBDA_ARN が設定されていません');
    return NextResponse.json({ detail: 'サーバー設定エラー' }, { status: 500 });
  }

  const arnRegion = functionArn.match(ARN_REGION_RE)?.[1];

  let payload: Uint8Array | undefined;
  let functionError: string | undefined;
  try {
    const result = await getLambdaClient(arnRegion).send(
      new InvokeCommand({
        FunctionName: functionArn,
        InvocationType: 'RequestResponse',
        // Lambda側は event["body"] をJSON文字列として json.loads() する実装のため、
        // ペイロードをそのまま渡すのではなく body キーに文字列化したJSONを入れる。
        Payload: Buffer.from(JSON.stringify({ body: JSON.stringify(body) })),
      })
    );
    payload = result.Payload;
    functionError = result.FunctionError;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { detail: `最適化エンジンの呼び出しに失敗しました: ${message}` },
      { status: 503 }
    );
  }

  let raw: unknown;
  try {
    raw = payload ? JSON.parse(Buffer.from(payload).toString('utf-8')) : null;
  } catch {
    return NextResponse.json(
      { detail: '最適化エンジンからの応答が不正です' },
      { status: 502 }
    );
  }

  if (functionError) {
    console.error('最適化Lambda実行エラー:', raw);
    return NextResponse.json(
      { detail: '最適化エンジンでエラーが発生しました' },
      { status: 502 }
    );
  }

  if (isProxyStyleResponse(raw)) {
    let parsedBody: unknown = raw.body;
    if (typeof raw.body === 'string') {
      try {
        parsedBody = JSON.parse(raw.body);
      } catch {
        parsedBody = raw.body;
      }
    }
    return NextResponse.json(parsedBody, { status: raw.statusCode });
  }

  return NextResponse.json(raw, { status: 200 });
}
