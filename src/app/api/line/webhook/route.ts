// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { messagingApi } from '@line/bot-sdk';

// 署名検証
function validateSignature(body: string, signature: string) {
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest('base64');
  return hash === signature;
}

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  console.log('Webhookリクエスト受信！');
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';
  console.log('LINE_CHANNEL_SECRET:', process.env.LINE_CHANNEL_SECRET ? '存在' : 'undefined');
  console.log('LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? '存在' : 'undefined');

  if (!validateSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('body:', body);
  const events = JSON.parse(body).events;

  for (const event of events) {
    if (event.type === 'follow') {
      console.log('友達追加イベント検出');
      await handleFollow(event);
    } else if (event.type === 'postback') {
      console.log('Postbackイベント検出');
      await handlePostback(event);
    } else if (event.type === 'message') {
      console.log('メッセージイベント検出');
      await handleMessage(event);
    }
  }

  return NextResponse.json({ status: 'OK' }, {
    headers: {
      'Cache-Control': 'no-store'
    },
  });
}

// 友達追加時の処理
async function handleFollow(event: any) {
  const lineUserId = event.source.userId;
  const profile = await client.getProfile(lineUserId);

  console.log('友達追加！LINE User ID:', lineUserId);
  console.log('名前:', profile.displayName);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        line_user_id: lineUserId,
        name: profile.displayName,
      }, {
        onConflict: 'line_user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('profiles upsertエラー:', error);
      throw error;
    }

    console.log('profiles登録成功:', data);

    // 挨拶メッセージ
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: `こんにちは、${profile.displayName}さん！\nシフト希望を提出できます。メニューから「シフト希望提出」を選んでください！`,
        },
      ],
    });
  } catch (err) {
    console.error('handleFollowエラー:', err);
  }
}

// メッセージ受信時（メニュー表示など）
async function handleMessage(event: any) {
  if (event.message.type !== 'text') return;

  const text = event.message.text.trim();
  const lineUserId = event.source.userId;

  // 店舗番号っぽい入力（英数4〜10文字くらい）を検知
  if (/^[A-Za-z0-9-]{4,10}$/.test(text)) {
    await handleStoreCodeInput(lineUserId, text, event.replyToken);
  } else {
    // 通常メッセージ（希望提出など）
    if (text.includes('希望') || text.includes('シフト')) {
      await sendShiftMenu(event.replyToken);
    } else {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '「シフト希望提出」と送るとメニューが出ます！' }],
      });
    }
  }
}

// 店舗番号入力処理
async function handleStoreCodeInput(lineUserId: string, code: string, replyToken: string) {
  // 店舗コードで店舗を探す
  const { data: store, error } = await supabase
    .from('stores')
    .select('id')
    .eq('store_code', code)
    .single();

  if (error || !store) {
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: '店舗コードが見つかりませんでした。もう一度確認してください！' }],
    });
    return;
  }

  // profilesにLINE userId登録（すでにあればスキップ）
  await supabase.from('profiles').upsert({
    line_user_id: lineUserId,
    // nameは友達追加時に入ってるはずなので省略可
  }, { onConflict: 'line_user_id' });

  // user_storesに登録（staffとして）
  const { error: storesError } = await supabase.from('user_stores').upsert({
    user_id: lineUserId,  // LINE userIdをuser_idとして使う（auth.usersと別管理）
    store_id: store.id,
    role: 'staff',
  }, { onConflict: 'user_id, store_id' });

  if (storesError) {
    console.error('user_stores登録エラー:', storesError);
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: '登録に失敗しました。店舗に連絡してください。' }],
    });
    return;
  }

  await client.replyMessage({
    replyToken,
    messages: [
      { type: 'text', text: '店舗登録完了しました！' },
      { type: 'text', text: 'これからシフト希望を提出できます。メニューから選んでください！' },
    ],
  });

  // 希望提出メニュー送る
  await sendShiftMenu(replyToken);
}

// postback処理（希望提出）
async function handlePostback(event: any) {
  const data = event.postback.data;
  const params = new URLSearchParams(data);

  const action = params.get('action');
  if (action === 'submit_preference') {
    const date = params.get('date');
    const status = params.get('status');
    const timeSlot = params.get('time_slot');

    if (!date || !status) return;

    await supabase.from('shift_preferences').upsert({
      user_id: event.source.userId,
      store_id: '固定店舗IDか後で選択', // ← 複数店舗対応なら後で実装
      shift_date: date,
      status,
      time_slot: timeSlot || null,
      note: null,
    });
    await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
            {
            type: 'text',
            text: `${date} の希望を${status}で登録しました！\nありがとうございます！`,
            },
        ],
    });
  }
}

// Flex Messageメニュー送信例
async function sendShiftMenu(replyToken: string) {
  const flexMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: 'シフト希望提出',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'シフト希望を提出',
            weight: 'bold',
            size: 'xl',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '◯ (出たい)',
              data: 'action=submit_preference&date=2026-02-10&status=ok',
            },
            style: 'primary',
          },
          // △ × などのボタンも追加
        ],
      },
    },
  };

    await client.replyMessage({
        replyToken: replyToken,
        messages: [flexMessage],
    });
}