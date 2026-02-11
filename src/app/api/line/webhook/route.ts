// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase/client';
import { config, client } from '@/lib/line/client';
import { messagingApi, middleware } from '@line/bot-sdk';

// 署名検証
function validateSignature(body: string, signature: string) {
  const hash = crypto
    .createHmac('sha256', config.channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

export async function POST(req: NextRequest) {
  console.log('Webhookリクエスト受信！');
  console.log('Headers:', Object.fromEntries(req.headers));
  const body = await req.text();
  console.log('Body:', body);
  const signature = req.headers.get('x-line-signature') || '';
  console.log('x-line-signature:', signature);

  if (!validateSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const events = JSON.parse(body).events;

  for (const event of events) {
    if (event.type === 'follow') {
      await handleFollow(event);
    } else if (event.type === 'postback') {
      await handlePostback(event);
    } else if (event.type === 'message') {
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
    const userId = event.source.userId;
    const profile = await client.getProfile(userId);

    // profilesに登録（すでにあれば更新）
    await supabase.from('profiles').upsert({
        id: userId,  // LINEのuserIdをidとして使う（auth.usersと別管理の場合）
        name: profile.displayName,
        line_user_id: userId,
    });

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
}

// メッセージ受信時（メニュー表示など）
async function handleMessage(event: any) {
  if (event.message.type === 'text') {
    // テキストで「希望提出」など言われたらFlexメニュー送る（簡易版）
    if (event.message.text.includes('希望')) {
      await sendShiftMenu(event.replyToken);
    }
  }
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