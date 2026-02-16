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
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POSTハンドラ
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!validateSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const parsed = JSON.parse(body);
  const events = parsed.events;

  for (const event of events) {
    if (event.replyToken && event.type === 'message' && event.message.type === 'text') {
      console.log('イベント受信:', event.type, 'ユーザーID:', event.source.userId);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '処理中です...！' }],
      });
      console.log('即時返信完了:', event.type, 'ユーザーID:', event.source.userId);
    }
  }

  events.forEach(async (event: any) => {
    console.log('イベント処理開始:', event.type, 'ユーザーID:', event.source.userId);
    if (event.type === 'follow') {
      console.log('友達追加イベント:', event.source.userId);
      await handleFollow(event); // replyTokenなしでDB登録だけ
      // setTimeout(() => handleFollow(event).catch(err => {
      //   console.error('遅延handleFollowエラー:', err);
      // }), 100); // 100ms遅延（即返事後に実行）
    } else if (event.type === 'message') {
      console.log('メッセージイベント:', event.source.userId, '内容:', event.message.text);
      await handleMessage(event);
    } else if (event.type === 'postback') {
      console.log('ポストバックイベント:', event.source.userId, 'データ:', event.postback.data);
      await handlePostback(event);
    }
  });

  return NextResponse.json({ status: 'OK' });
}

// イベント処理（replyToken使わない）
async function processEvent(event: any) {
  console.log('イベント処理開始:', event.type, 'ユーザーID:', event.source.userId);
  try {
    if (event.type === 'follow') {
      await handleFollow(event); // replyTokenなしでDB登録だけ
    } else if (event.type === 'message') {
      await handleMessage(event);
    } else if (event.type === 'postback') {
      await handlePostback(event);
    }
  } catch (err) {
    console.error('processEventエラー:', event.type, err);
  }
}

// 友達追加時の処理
async function handleFollow(event: any) {
  const lineUserId = event.source.userId;
  console.log('友達追加イベント受信！ユーザーID:', lineUserId);
  // const profile = await getProfileWithRetry(lineUserId);
  const profile = await client.getProfile(lineUserId).then(profile => {
    console.log('getProfile成功:', profile.displayName);
    return profile;
  }).catch(err => {
    console.error('getProfile失敗:', err instanceof Error ? err.message : String(err));
    return { displayName: '未設定' }; // プロフィール取得失敗時のデフォルト値
  });

  console.log('友達追加処理開始', { lineUserId, name: profile.displayName });

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        line_user_id: lineUserId,
        name: profile.displayName || '未設定',
      }, {
        onConflict: 'line_user_id',
        ignoreDuplicates: false,
      });

    if (error) throw error;

    console.log('profiles登録成功');
  } catch (err) {
    console.error('profiles登録失敗:', err);
  }
}

async function getProfileWithRetry(userId: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`getProfile リトライ${attempt}開始: ユーザーID ${userId}`);
      const profile = await client.getProfile(userId);
      console.log(`getProfile リトライ${attempt}成功:`, profile);
      return profile;
    } catch (err: any) {
      console.error(`getProfile リトライ${attempt}/${maxRetries}失敗:`, err.message);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt)); // 1秒、2秒、3秒待機
    }
  }
  throw new Error('getProfile failed after retries');
}

async function getProfileSafe(userId: string) {
  const maxRetries = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`getProfile 試行${attempt}/${maxRetries}`);
      const profile = await client.getProfile(userId);
      console.log('getProfile成功:', profile.displayName);
      return profile;
    } catch (err) {
      lastError = err;
      console.error(`getProfile失敗（試行${attempt}）:`, err instanceof Error ? err.message : String(err));
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500)); // 1.5秒待機
      }
    }
  }

  console.error('getProfile完全失敗:', lastError);
  throw lastError;
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
  const trimmedCode = code.trim(); // スペース除去
  const upperCode = trimmedCode.toUpperCase();
  console.log('店舗コード入力受信！入力値:', upperCode);

  // クエリ実行前にログ
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, name, store_code')
    .eq('store_code', upperCode)
    .single();

  console.log('クエリ結果 - error:', error);
  console.log('クエリ結果 - data:', store);

  if (error || !store) {
    console.error('店舗検索失敗:', error?.message || 'レコードなし');
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: '店舗コードが見つかりませんでした。\n入力したコード: ' + trimmedCode + '\nもう一度確認してください！' }],
    });
    return;
  }

  console.log('店舗発見！ID:', store.id, '名前:', store.name);

  // profilesにLINE userId登録（すでにあればスキップ）
  await supabase.from('profiles').upsert({
    line_user_id: lineUserId,
    // nameは友達追加時に入ってるはずなので省略可
  }, { onConflict: 'line_user_id' });

  // user_storesに登録（staffとして）
  const { error: storesError } = await supabase.from('user_stores').upsert({
    user_id: lineUserId,
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