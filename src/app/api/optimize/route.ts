import { NextRequest, NextResponse } from 'next/server';

const ENGINE_URL = process.env.OPTIMIZATION_ENGINE_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'リクエストの形式が正しくありません' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${ENGINE_URL}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
