import { createClient } from '@supabase/supabase-js';
import { WebhookRequestBody, PostbackEvent, messagingApi  } from '@line/bot-sdk'; // npm install @line/bot-sdk
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

// 新しいクライアントインスタンス（グローバル or 毎回作るかは好みで）
const client = new messagingApi.MessagingApiClient({ channelAccessToken });

// 署名検証関数
function validateSignature(body: string, signature: string): boolean {
  const hash = crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(body).digest('base64');
  return hash === signature;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!validateSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const { events }: WebhookRequestBody = JSON.parse(body);

  for (const event of events) {
    if (event.type === 'postback') {
      await handlePostback(event as PostbackEvent);
    }
  }

  return NextResponse.json({ status: 'OK' });
}

// postbackハンドラー
async function handlePostback(event: PostbackEvent) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action'); // カスタムで追加可能

  if (data.has('date') && data.has('status')) {
    // 日付とステータスをDBに保存（例: upsertで更新）
    const userId = event.source.userId!;
    const storeId = 'dummy_store_id'; // 実際はユーザーから取得

    const { error } = await supabase
      .from('shift_preferences')
      .upsert({
        user_id: userId,
        store_id: storeId,
        date: data.get('date'),
        status: data.get('status'),
      }, { onConflict: 'user_id, date' }); // 同じ日更新時は上書き

    if (error) {
      console.error('DB Error:', error);
      // エラー時はLINEにreplyで通知（別関数で）
        await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'エラー発生！後で試してね' }],
        });
      return;
    }

    // 成功時は確認reply
    await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `${data.get('date')}を${data.get('status')}に設定したよ！` }],
    });
  } else if (data.get('submit_all')) {
    // 全確定時の処理（例: 店長に通知 or ドラフト生成トリガー）
    await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '希望提出完了！店長が調整するね〜' }],
    });
    // ここで店長PushやWebSocketで通知（Supabase Realtime）
  }
}
