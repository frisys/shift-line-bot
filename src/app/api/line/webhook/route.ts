// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { messagingApi } from '@line/bot-sdk';
import fs from 'fs/promises';

// 署名検証
function validateSignature(body: string, signature: string) {
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest('base64');
  return hash === signature;
}

const messagingClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!
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
    const lineUserId = event.source.userId;

    let profile;
    try {
      profile = await messagingClient.getProfile(lineUserId);
    } catch (err) {
      console.error('getProfile完全失敗:', err);
      profile = { displayName: 'ゲストユーザー' };
    }

    console.log('イベント処理開始:', event.type, 'ユーザーID:', lineUserId);
    if (event.type === 'follow') {
      console.log('友達追加イベント受信');
      console.log('LINE User ID:', lineUserId);
      console.log('表示名:', profile.displayName);
      await handleFollow(event, profile);
    } else if (event.type === 'message') {
      console.log('メッセージイベント:', lineUserId, '内容:', event.message.text);
      if (event.replyToken && event.type === 'message' && event.message.type === 'text') {
        await messagingClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '処理中です...！' }],
        });
        console.log('即時返信完了:', event.type, 'ユーザーID:', lineUserId);
      }
      await handleMessage(event);
    } else if (event.type === 'postback') {
      console.log('ポストバックイベント:', lineUserId, 'データ:', event.postback.data);
      await handlePostback(event);
    }
  };
  return NextResponse.json({ status: 'OK' });
}

// 友達追加時の処理
async function handleFollow(event: any, profile: any) {
  const lineUserId = event.source.userId;
  const replyToken = event.replyToken;

  try {
    const { data, error } =await supabase
    .from('profiles')
    .upsert({
      line_user_id: lineUserId,
      name: profile!.displayName || '未設定',
    }, { 
      onConflict: 'line_user_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

    if (error) {
      console.error('profiles upsertエラー:', error);
      return;
    }

    console.log('登録成功！inserted data:', data);
  } catch (err) {
    console.error('handleFollow全体エラー:', err);
  }
  await createAndSetRichMenu(lineUserId);

  // 挨拶メッセージ（必ず最後に）
  await messagingClient.replyMessage({
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: `こんにちは、${profile.displayName}さん！\n\nあなたの店舗コードを入力してください。\n例: ABC123\n（店長からもらった6桁のコードです）`,
      },
    ],
  });
}

// メッセージ受信時（メニュー表示など）
async function handleMessage(event: any) {
  const lineUserId = event.source.userId;
  const text = event.message.text.trim();
  // 店舗番号っぽい入力（英数4〜10文字くらい）を検知
  if (/^[A-Za-z0-9-]{4,10}$/.test(text)) {
    await handleStoreCodeInput(lineUserId, text);
  } else {
    // 通常メッセージ（希望提出など）
    if (text.includes('希望') || text.includes('シフト')) {
      await sendShiftMenu(lineUserId);
    } else {
      await messagingClient.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text: '「シフト希望提出」と送るとメニューが出ます！' }],
      });
    }
  }
}

// 店舗番号入力処理
async function handleStoreCodeInput(lineUserId: string, code: string) {
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
    await messagingClient.pushMessage({
      to: lineUserId,
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
    await messagingClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: '登録に失敗しました。店舗に連絡してください。' }],
    });
    return;
  }

  await messagingClient.pushMessage({
    to: lineUserId,
    messages: [
      { type: 'text', text: '店舗登録完了しました！' },
      { type: 'text', text: 'これからシフト希望を提出できます。下のメニューから「シフト希望提出」をタップしてください！' },
    ],
  });

  // リッチメニュー適用（メニューIDを環境変数から取る）
  await messagingClient.setDefaultRichMenu(process.env.LINE_RICH_MENU_ID!);
}

// postback処理（希望提出）
async function handlePostback(event: any) {
  const data = event.postback.data;
  const params = new URLSearchParams(data);
  const action = params.get('action');

  if (action === 'submit_shift') {
    await sendShiftMenu(event.source.userId); // pushMessageでFlex送る
  } else if (action === 'change_store') {
    await handleChangeStore(event.source.userId, event.replyToken);
  } else if (action === 'view_preferences') {
    const date = params.get('date');
    const status = params.get('status');
    const timeSlot = params.get('time_slot');
  }
}

// Flex Messageメニュー送信例
async function sendShiftMenu(lineUserId: string) {
  const flexMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: 'シフト希望提出',
    contents: {
      type: 'carousel',
      contents: [
        // 日付選択Flexのバブル複数
        {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '希望日を選択', weight: 'bold', size: 'lg' },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '2/15 (日)',
                  data: 'action=select_date&date=2026-02-15',
                },
                style: 'primary',
              },
            ],
          },
        },
      ],
    },
  };

    await messagingClient.pushMessage({
        to: lineUserId,
        messages: [flexMessage],
    });
}

async function getUserStores(lineUserId: string) {
  const { data, error } = await supabase
    .from('user_stores')
    .select(`
      store_id,
      stores (name, store_code)
    `)
    .eq('user_id', lineUserId);

  if (error) {
    console.error('登録店舗取得エラー:', error);
    return [];
  }

  return data.map((item: any) => ({
    store_id: item.store_id,
    name: item.stores?.name || '不明',
    store_code: item.stores?.store_code || '不明',
  }));
}

async function handleChangeStore(lineUserId: string, replyToken: string) {
  const registeredStores = await getUserStores(lineUserId);

  if (registeredStores.length === 0) {
    await messagingClient.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: '現在登録されている店舗はありません。\n新しい店舗コードを入力してください！',
        },
      ],
    });
    return;
  }

  // 登録店舗一覧をFlexで表示
  const flexContents: messagingApi.FlexBubble[] = registeredStores.map(store => ({
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: store.name,
          weight: 'bold',
          size: 'lg',
        },
        {
          type: 'text',
          text: `コード: ${store.store_code}`,
          size: 'sm',
          color: '#AAAAAA',
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'この店舗に切り替え',
            data: `action=switch_store&store_id=${store.store_id}`,
          },
          style: 'primary',
          margin: 'md',
        },
      ],
    },
  }));

  const flexMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: '登録店舗選択',
    contents: {
      type: 'carousel',
      contents: flexContents,
    },
  };

  await messagingClient.replyMessage({
    replyToken,
    messages: [
      { type: 'text', text: '登録済み店舗一覧です。切り替えたい店舗を選択してください。' },
      flexMessage,
      { type: 'text', text: '新規店舗を追加したい場合は、新しい店舗コードを入力してください。' },
    ],
  });
}

async function createAndSetRichMenu(lineUserId: string) {
  try {
    // リッチメニュー定義（2行4列例）
    const richMenu: messagingApi.RichMenuRequest = {
      size: { width: 2500, height: 1686 }, // Largeサイズ（推奨）
      selected: true,
      name: 'シフト管理メニュー',
      chatBarText: 'メニューを開く',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 843 },
          action: {
            type: 'postback',
            data: 'action=submit_shift',
          },
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 843 },
          action: {
            type: 'postback',
            data: 'action=view_preferences',
          },
        },
        {
          bounds: { x: 0, y: 843, width: 1250, height: 843 },
          action: {
            type: 'postback',
            data: 'action=change_store',
          },
        },
        {
          bounds: { x: 1250, y: 843, width: 1250, height: 843 },
          action: {
            type: 'uri',
            uri: 'https://your-app.vercel.app/help', // ヘルプページURL
            label: 'ヘルプ',
          },
        },
      ],
    };

    // リッチメニュー作成
    const createResponse = await messagingClient.createRichMenu(richMenu);
    const richMenuId = createResponse.richMenuId;
    console.log('リッチメニュー作成成功:', richMenuId);

    // 画像アップロード
    const imageBuffer = await fs.readFile('public/rich-menu.png');
    await blobClient.setRichMenuImage(richMenuId, new Blob([imageBuffer], { type: 'image/png' }));
    console.log('リッチメニュー画像アップロード成功');

    // **ユーザーごとに適用**（これが大事！）
    await messagingClient.linkRichMenuIdToUser(lineUserId, richMenuId);

    console.log('リッチメニューをユーザー', lineUserId, 'に適用成功');

    return richMenuId;
  } catch (err) {
    console.error('リッチメニュー作成/適用エラー:', err);
    return null;
  }
}