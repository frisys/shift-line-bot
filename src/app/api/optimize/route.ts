import { NextRequest, NextResponse } from 'next/server';

const LAMBDA_URL = process.env.OPTIMIZE_LAMBDA_URL ?? '';
const LAMBDA_SECRET = process.env.OPTIMIZE_LAMBDA_SECRET ?? '';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'リクエストの形式が正しくありません' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': LAMBDA_SECRET,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { detail: `最適化エンジンに接続できませんでした: ${message}` },
      { status: 503 }
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json(
      { detail: `最適化エンジンからの応答が不正です (HTTP ${res.status})` },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: res.status });
}
