// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  messagingApi,
  WebhookEvent,
  FollowEvent,
  MessageEvent,
  PostbackEvent,
  Profile,
} from '@line/bot-sdk';
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
  const events: WebhookEvent[] = parsed.events;

  for (const event of events) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    let profile: Profile | { displayName: string };
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
      await handleFollow(event as FollowEvent, profile);
    } else if (event.type === 'message') {
      const messageEvent = event as MessageEvent;
      if (messageEvent.message.type === 'text') {
        console.log('メッセージイベント:', lineUserId, '内容:', messageEvent.message.text);
      }
      if (messageEvent.replyToken && messageEvent.message.type === 'text') {
        await messagingClient.replyMessage({
          replyToken: messageEvent.replyToken,
          messages: [{ type: 'text', text: '処理中です...！' }],
        });
        console.log('即時返信完了:', event.type, 'ユーザーID:', lineUserId);
      }
      await handleMessage(messageEvent);
    } else if (event.type === 'postback') {
      console.log('ポストバックイベント:', lineUserId, 'データ:', (event as PostbackEvent).postback.data);
      await handlePostback(event as PostbackEvent);
    }
  }
  return NextResponse.json({ status: 'OK' });
}

// 友達追加時の処理
async function handleFollow(event: FollowEvent, profile: Profile | { displayName: string }) {
  const lineUserId = event.source.userId!;
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
        text: `${profile.displayName}さん！お疲れ様です！\nシフト管理君を追加してくれてありがとうございます！`,
      },
      {
        type: 'text',
        text: `まずは働く店舗の登録をしましょう。\n\nリッチメニューから店舗登録を選択し、\n店長からもらった店舗コードを入力してください。\n例: ABC123\n\n※複数の店舗で働く場合は、その都度リッチメニューから登録してください。`,
      },
    ],
  });
}

// メッセージ受信時（メニュー表示など）
async function handleMessage(event: MessageEvent) {
  const lineUserId = event.source.userId!;
  if (event.message.type !== 'text') return;
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

// 店舗番号入力処理（確認メッセージを表示）
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
      messages: [{ type: 'text', text: '店舗コードが ' + trimmedCode + ' の店舗は見つかりませんでした。\n確認してやり直しをお願いします。' }],
    });
    return;
  }

  console.log('店舗発見！ID:', store.id, '名前:', store.name);

  // 登録確認のFlexメッセージ
  const confirmRegisterMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: `「${store.name}」を登録しますか？`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 店舗確認',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: `「${store.name}」`,
            size: 'lg',
            margin: 'lg',
            weight: 'bold',
            wrap: true,
          },
          {
            type: 'text',
            text: `店舗コード: ${store.store_code}`,
            size: 'sm',
            margin: 'sm',
            color: '#666666',
          },
          {
            type: 'text',
            text: 'この店舗を登録しますか？',
            size: 'md',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            margin: 'lg',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '登録する',
                  data: `action=register_store&store_id=${store.id}`,
                },
                style: 'primary',
                color: '#1DB446',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'やめる',
                  data: 'action=cancel_register_store',
                },
                style: 'secondary',
              },
            ],
          },
        ],
      },
    },
  };

  await messagingClient.pushMessage({
    to: lineUserId,
    messages: [confirmRegisterMessage],
  });
}

// 店舗登録実行
async function handleRegisterStore(lineUserId: string, storeId: string) {
  // 店舗情報を取得
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    await messagingClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: '店舗情報の取得に失敗しました。もう一度店舗コードを入力してください。' }],
    });
    return;
  }

  // profilesにLINE userId登録（すでにあればスキップ）
  await supabase.from('profiles').upsert({
    line_user_id: lineUserId,
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
      messages: [{ type: 'text', text: '登録に失敗したので少し時間を空けて初めからやり直してみてください。\n\n何回も失敗する場合はヘルプから問い合わせをお願いします！' }],
    });
    return;
  }

  // 切り替え確認のFlexメッセージ
  const confirmSwitchMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: `「${store.name}」への登録が完了しました`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🎉 登録完了',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: `「${store.name}」を登録しました！`,
            size: 'md',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'text',
            text: 'この店舗に切り替えますか？',
            size: 'sm',
            margin: 'lg',
            color: '#666666',
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            margin: 'lg',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '切り替えて',
                  data: `action=confirm_switch_store&store_id=${store.id}`,
                },
                style: 'primary',
                color: '#1DB446',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '今のままで',
                  data: 'action=keep_current_store',
                },
                style: 'secondary',
              },
            ],
          },
        ],
      },
    },
  };

  await messagingClient.pushMessage({
    to: lineUserId,
    messages: [confirmSwitchMessage],
  });

  // リッチメニュー適用（メニューIDを環境変数から取る）
  await messagingClient.setDefaultRichMenu(process.env.LINE_RICH_MENU_ID!);
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

interface UserStoreQueryResult {
  store_id: string;
  stores: { name: string; store_code: string } | { name: string; store_code: string }[] | null;
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

  return (data as unknown as UserStoreQueryResult[]).map((item) => {
    const stores = Array.isArray(item.stores) ? item.stores[0] : item.stores;
    return {
      store_id: item.store_id,
      name: stores?.name || '不明',
      store_code: stores?.store_code || '不明',
    };
  });
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
      { type: 'text', text: 'どの店舗に切替えますか？' },
      flexMessage,
      { type: 'text', text: '新しく店舗を追加したい場合は、新しい店舗コードを教えてください。' },
    ],
  });
}

// 店舗切り替え実行
async function handleSwitchStore(lineUserId: string, storeId: string) {
  // 店舗情報を取得
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    await messagingClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: '店舗情報の取得に失敗しました。' }],
    });
    return;
  }

  // profilesテーブルのactive_store_idを更新
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_store_id: storeId })
    .eq('line_user_id', lineUserId);

  if (updateError) {
    console.error('active_store_id更新エラー:', updateError);
    // エラーでも切り替えメッセージは送る（カラムがない場合など）
  }

  await messagingClient.pushMessage({
    to: lineUserId,
    messages: [
      { type: 'text', text: `「${store.name}」に切り替えました！\n\nシフト希望を提出する場合は、リッチメニューから「シフト希望を提出」をタップしてください。` },
    ],
  });
}

// postback処理（希望提出）
async function handlePostback(event: PostbackEvent) {
  try {
    const data = event.postback.data;
    const params = new URLSearchParams(data);
    const action = params.get('action');
    const lineUserId = event.source.userId!;

    // 空ボタン（カレンダーの空白部分）は無視
    if (action === 'noop') {
      return;
    }

    if (action === 'submit_shift') {
      // 月選択メニューを送信
      await sendMonthPicker(lineUserId);
    } else if (action === 'view_preferences') {
      // シフト希望を確認
      await sendPreferencesSummary(lineUserId);
    } else if (action === 'change_store') {
      // 店舗を切り替える
      await handleChangeStore(lineUserId, event.replyToken);
    } else if (action === 'register_store') {
      // 店舗登録実行
      const storeId = params.get('store_id');
      if (!storeId) {
        await messagingClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '店舗情報が取得できませんでした。もう一度店舗コードを入力してください。' }],
        });
        return;
      }
      await handleRegisterStore(lineUserId, storeId);
    } else if (action === 'cancel_register_store') {
      // 店舗登録キャンセル
      await messagingClient.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text: '登録をキャンセルしました。\n\n別の店舗コードを入力するか、リッチメニューから操作してください。' }],
      });
    } else if (action === 'switch_store') {
      // 店舗切り替え実行
      const storeId = params.get('store_id');
      if (!storeId) {
        await messagingClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '店舗情報が取得できませんでした。' }],
        });
        return;
      }
      await handleSwitchStore(lineUserId, storeId);
    } else if (action === 'confirm_switch_store') {
      // 登録完了後の切り替え確認 → 切り替える
      const storeId = params.get('store_id');
      if (!storeId) {
        await messagingClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '店舗情報が取得できませんでした。' }],
        });
        return;
      }
      await handleSwitchStore(lineUserId, storeId);
    } else if (action === 'keep_current_store') {
      // 登録完了後の切り替え確認 → 今のままで
      await messagingClient.pushMessage({
        to: lineUserId,
        messages: [
          { type: 'text', text: '了解です！現在の店舗のままにしておきますね。\n\n💡 切り替えたくなったらリッチメニューの「店舗切り替え」からいつでも変更できます。' },
        ],
      });
    } else if (action === 'select_month') {
      // 選択された月の日付選択フォームを送信
      const year = params.get('year');
      const month = params.get('month');
      if (!year || !month) {
        await messagingClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '月が取得できませんでした。もう一度お試しください。' }],
        });
        return;
      }
      await sendShiftDatePicker(lineUserId, parseInt(year), parseInt(month));
    } else if (action === 'select_date') {
      const date = params.get('date');
      if (!date) {
        await messagingClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '日付が取得できませんでした。もう一度お試しください。' }],
        });
        return;
      }
      await sendStatusPicker(lineUserId, date);
    } else if (action === 'select_status') {
      const date = params.get('date');
      const status = params.get('status');
      if (!date || !status) {
        await messagingClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '日付または希望が取得できませんでした。もう一度お試しください。' }],
        });
        return;
      }
      await sendTimeSlotPicker(lineUserId, date, status);
    } else if (action === 'select_time_slot') {
      const date = params.get('date');
      const status = params.get('status');
      const timeSlot = params.get('time_slot');
      if (!date || !status || !timeSlot) {
        await messagingClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '必要な情報が取得できませんでした。もう一度お試しください。' }],
        });
        return;
      }
      await savePreference(lineUserId, date, status, timeSlot);
    }
  } catch (err) {
    console.error('handlePostbackエラー:', err);
    const userId = event.source.userId;
    if (userId) {
      await messagingClient.pushMessage({
        to: userId,
        messages: [{ type: 'text', text: '処理中にエラーが発生しました。もう一度試してください。' }],
      });
    }
  }
}

// 月選択メニューを送信
async function sendMonthPicker(userId: string) {
  // ユーザーの登録店舗を取得
  const stores = await getUserStores(userId);
  if (stores.length === 0) {
    await messagingClient.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: '店舗が登録されていません。\n先に店舗コードを入力してください。' }],
    });
    return;
  }

  const storeId = stores[0].store_id;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 次月
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  // シフト選択ページのURL生成
  const currentMonthUrl = `${baseUrl}/shift-select?year=${currentYear}&month=${currentMonth}&userId=${userId}&storeId=${storeId}`;
  const nextMonthUrl = `${baseUrl}/shift-select?year=${nextYear}&month=${nextMonth}&userId=${userId}&storeId=${storeId}`;

  const flexMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: 'シフト希望を提出する月を選択',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📅 シフト希望提出',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: '何月のシフトを提出しますか？',
            size: 'md',
            margin: 'md',
            color: '#666666',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: `${currentMonth}月（今月）`,
                  uri: currentMonthUrl,
                },
                style: 'primary',
                color: '#1DB446',
              },
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: `${nextMonth}月（来月）`,
                  uri: nextMonthUrl,
                },
                style: 'secondary',
              },
            ],
          },
        ],
      },
    },
  };

  await messagingClient.pushMessage({
    to: userId,
    messages: [flexMessage],
  });
}

// 日付選択メニューを送信（指定月の日付を動的生成）
async function sendShiftDatePicker(userId: string, year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  // 週ごとにボタンをグループ化
  const weeks: messagingApi.FlexBox[] = [];
  let currentWeek: messagingApi.FlexButton[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const label = `${day}(${weekdays[dayOfWeek]})`;

    currentWeek.push({
      type: 'button',
      action: {
        type: 'postback',
        label: label,
        data: `action=select_date&date=${dateStr}`,
      },
      style: 'primary',
      color: dayOfWeek === 0 ? '#FF6B6B' : dayOfWeek === 6 ? '#4DABF7' : '#1DB446',
      height: 'sm',
      flex: 1,
    });

    // 7日ごとまたは月末で週を確定
    if (dayOfWeek === 6 || day === daysInMonth) {
      // 週の先頭を埋める（月初が日曜でない場合）
      if (day <= 7) {
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
          currentWeek.unshift({
            type: 'button',
            action: { type: 'postback', label: ' ', data: 'action=noop' },
            style: 'secondary',
            color: '#CCCCCC',
            height: 'sm',
            flex: 1,
          });
        }
      }

      // 週の末尾を埋める
      while (currentWeek.length < 7) {
        currentWeek.push({
          type: 'button',
          action: { type: 'postback', label: ' ', data: 'action=noop' },
          style: 'secondary',
          color: '#CCCCCC',
          height: 'sm',
          flex: 1,
        });
      }

      weeks.push({
        type: 'box',
        layout: 'horizontal',
        spacing: 'xs',
        contents: currentWeek,
      });
      currentWeek = [];
    }
  }

  const flexMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: `${month}月の希望日を選択`,
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📅 ${year}年${month}月`,
            weight: 'bold',
            size: 'xl',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: '希望を提出する日を選択してください',
            size: 'sm',
            margin: 'md',
            color: '#666666',
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'lg',
            contents: weekdays.map((wd, i) => ({
              type: 'text',
              text: wd,
              size: 'xs',
              align: 'center',
              color: i === 0 ? '#FF6B6B' : i === 6 ? '#4DABF7' : '#666666',
              flex: 1,
            })) as messagingApi.FlexText[],
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            margin: 'sm',
            contents: weeks,
          },
        ],
      },
    },
  };

  await messagingClient.pushMessage({
    to: userId,
    messages: [flexMessage],
  });
}
async function sendStatusPicker(userId: string, date: string) {
  const flexMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: `${date} の希望を選択`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${date} の希望は？`,
            weight: 'bold',
            size: 'xl',
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            margin: 'md',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '◯ 出勤可',
                  data: `action=select_status&date=${date}&status=ok`,
                },
                style: 'primary',
                color: '#00FF00',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '△ 微妙',
                  data: `action=select_status&date=${date}&status=maybe`,
                },
                style: 'primary',
                color: '#FFFF00',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '× 休み',
                  data: `action=select_status&date=${date}&status=no`,
                },
                style: 'primary',
                color: '#FF0000',
              },
            ],
          },
        ],
      },
    },
  };

  await messagingClient.pushMessage({
    to: userId,
    messages: [flexMessage],
  });
}

async function sendTimeSlotPicker(userId: string, date: string, status: string) {
  const timeSlots = ['早番', '日勤', '遅番', '夜勤', 'フル', '休み希望'];

  const buttons: messagingApi.FlexButton[] = timeSlots.map(slot => ({
    type: 'button',
    action: {
      type: 'postback',
      label: slot,
      data: `action=select_time_slot&date=${date}&status=${status}&time_slot=${slot}`,
    },
    style: 'primary',
    margin: 'sm',
  }));

  const flexMessage: messagingApi.FlexMessage = {
    type: 'flex',
    altText: `${date} の時間帯`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `${date} の時間帯を選択`, weight: 'bold', size: 'xl' },
          { type: 'box', layout: 'vertical', spacing: 'md', margin: 'md', contents: buttons },
        ],
      },
    },
  };

  await messagingClient.pushMessage({
    to: userId,
    messages: [flexMessage],
  });
}

async function savePreference(userId: string, date: string, status: string, timeSlot: string | null) {
  // ユーザーの登録店舗を取得
  const stores = await getUserStores(userId);
  if (stores.length === 0) {
    await messagingClient.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: '店舗が登録されていません。\n先に店舗コードを入力してください。' }],
    });
    return;
  }

  // 最初の登録店舗を使用（複数店舗対応は今後拡張）
  const storeId = stores[0].store_id;

  const { error } = await supabase.from('shift_preferences').upsert({
    user_id: userId,
    store_id: storeId,
    shift_date: date,
    status,
    time_slot: timeSlot,
    note: null,
  }, { onConflict: 'user_id,store_id,shift_date' });

  if (error) {
    console.error('希望保存エラー:', error);
    await messagingClient.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: '保存に失敗しました。もう一度試してください。' }],
    });
    return;
  }

  const statusLabel = status === 'ok' ? '出勤可' : status === 'maybe' ? '微妙' : '休み';
  await messagingClient.pushMessage({
    to: userId,
    messages: [{ type: 'text', text: `${date} の希望を「${statusLabel}」で登録しました！\nありがとうございます！` }],
  });
}

// シフト希望確認（カレンダー形式で表示）
async function sendPreferencesSummary(userId: string) {
  const stores = await getUserStores(userId);
  if (stores.length === 0) {
    await messagingClient.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: '店舗が登録されていません。\n先に店舗コードを入力してください。' }],
    });
    return;
  }

  const storeId = stores[0].store_id;
  const storeName = stores[0].name;

  // 今月と翌月の希望を取得
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;

  // 今月の範囲
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  // 翌月の範囲
  const nextMonthStartDate = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const nextMonthLastDay = new Date(nextMonthYear, nextMonth, 0).getDate();
  const nextMonthEndDate = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-${nextMonthLastDay}`;

  const { data: preferences, error } = await supabase
    .from('shift_preferences')
    .select('shift_date, status, time_slot')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .gte('shift_date', startDate)
    .lte('shift_date', nextMonthEndDate)
    .order('shift_date', { ascending: true });

  if (error) {
    console.error('希望取得エラー:', error);
    await messagingClient.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: '希望の取得に失敗しました。' }],
    });
    return;
  }

  // 今月と翌月の希望をそれぞれMapに変換
  const currentMonthPrefMap: Record<string, { status: string; time_slot: string | null }> = {};
  const nextMonthPrefMap: Record<string, { status: string; time_slot: string | null }> = {};

  preferences?.forEach(p => {
    if (p.shift_date >= startDate && p.shift_date <= endDate) {
      currentMonthPrefMap[p.shift_date] = { status: p.status, time_slot: p.time_slot };
    } else if (p.shift_date >= nextMonthStartDate && p.shift_date <= nextMonthEndDate) {
      nextMonthPrefMap[p.shift_date] = { status: p.status, time_slot: p.time_slot };
    }
  });

  // 確定状態を取得
  const currentYearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const nextYearMonth = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}`;

  const { data: confirmations } = await supabase
    .from('shift_confirmations')
    .select('year_month, is_confirmed')
    .eq('store_id', storeId)
    .in('year_month', [currentYearMonth, nextYearMonth]);

  const confirmationMap: Record<string, boolean> = {};
  confirmations?.forEach(c => {
    confirmationMap[c.year_month] = c.is_confirmed;
  });

  const isCurrentMonthConfirmed = confirmationMap[currentYearMonth] ?? false;
  const isNextMonthConfirmed = confirmationMap[nextYearMonth] ?? false;

  // 翌月分の希望がある場合はカルーセルで表示
  const hasNextMonthPreferences = Object.keys(nextMonthPrefMap).length > 0;

  if (hasNextMonthPreferences) {
    // カルーセル形式で今月と翌月を表示
    const currentMonthBubble = buildCalendarFlexBubble(year, month, storeName, currentMonthPrefMap, isCurrentMonthConfirmed);
    const nextMonthBubble = buildCalendarFlexBubble(nextMonthYear, nextMonth, storeName, nextMonthPrefMap, isNextMonthConfirmed);

    const carouselMessage: messagingApi.FlexMessage = {
      type: 'flex',
      altText: `${month}月・${nextMonth}月のシフト希望`,
      contents: {
        type: 'carousel',
        contents: [currentMonthBubble, nextMonthBubble],
      },
    };

    await messagingClient.pushMessage({
      to: userId,
      messages: [carouselMessage],
    });
  } else {
    // 今月のみ表示
    const flexMessage = buildCalendarFlexMessage(year, month, storeName, currentMonthPrefMap, isCurrentMonthConfirmed);

    await messagingClient.pushMessage({
      to: userId,
      messages: [flexMessage],
    });
  }
}

// カレンダー形式のFlex Bubbleを生成（カルーセル用）
function buildCalendarFlexBubble(
  year: number,
  month: number,
  storeName: string,
  prefMap: Record<string, { status: string; time_slot: string | null }>,
  isConfirmed: boolean = false
): messagingApi.FlexBubble {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const statusColors: Record<string, string> = {
    ok: '#22C55E',     // 緑
    maybe: '#EAB308',  // 黄
    no: '#EF4444',     // 赤
  };
  const statusIcons: Record<string, string> = {
    ok: '◯',
    maybe: '△',
    no: '×',
  };

  // 週ごとにボタンをグループ化
  const weeks: messagingApi.FlexBox[] = [];
  let currentWeek: messagingApi.FlexBox[] = [];

  // 月初の空白を埋める
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({
      type: 'box',
      layout: 'vertical',
      flex: 1,
      contents: [
        { type: 'text', text: ' ', size: 'xs', align: 'center' },
        { type: 'text', text: ' ', size: 'lg', align: 'center' },
        { type: 'text', text: ' ', size: 'xxs', align: 'center' },
      ],
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const pref = prefMap[dateStr];

    const dayColor = dayOfWeek === 0 ? '#EF4444' : dayOfWeek === 6 ? '#3B82F6' : '#374151';
    const statusIcon = pref ? statusIcons[pref.status] || '-' : '-';
    const statusColor = pref ? statusColors[pref.status] || '#9CA3AF' : '#9CA3AF';
    const timeSlot = pref?.time_slot ? pref.time_slot.substring(0, 1) : ' ';

    currentWeek.push({
      type: 'box',
      layout: 'vertical',
      flex: 1,
      contents: [
        { type: 'text', text: String(day), size: 'xs', align: 'center', color: dayColor },
        { type: 'text', text: statusIcon, size: 'lg', align: 'center', color: statusColor, weight: 'bold' },
        { type: 'text', text: timeSlot, size: 'xxs', align: 'center', color: '#6B7280' },
      ],
    });

    // 7日ごとまたは月末で週を確定
    if (dayOfWeek === 6 || day === daysInMonth) {
      // 週の末尾を埋める
      while (currentWeek.length < 7) {
        currentWeek.push({
          type: 'box',
          layout: 'vertical',
          flex: 1,
          contents: [
            { type: 'text', text: ' ', size: 'xs', align: 'center' },
            { type: 'text', text: ' ', size: 'lg', align: 'center' },
            { type: 'text', text: ' ', size: 'xxs', align: 'center' },
          ],
        });
      }

      weeks.push({
        type: 'box',
        layout: 'horizontal',
        spacing: 'xs',
        contents: currentWeek,
      });
      currentWeek = [];
    }
  }

  // タイトル部分（確定状態に応じて変更）
  const titleContents: messagingApi.FlexComponent[] = isConfirmed
    ? [
        {
          type: 'text',
          text: `📋 ${year}年${month}月`,
          weight: 'bold',
          size: 'xl',
          color: '#1DB446',
          flex: 0,
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '確定',
              weight: 'bold',
              size: 'sm',
              color: '#FFFFFF',
              align: 'center',
            },
          ],
          backgroundColor: '#1DB446',
          cornerRadius: 'md',
          paddingStart: 'sm',
          paddingEnd: 'sm',
          paddingTop: 'xxs',
          paddingBottom: 'xxs',
          margin: 'md',
        },
      ]
    : [
        {
          type: 'text',
          text: `📋 ${year}年${month}月`,
          weight: 'bold',
          size: 'xl',
          color: '#1DB446',
        },
      ];

  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: titleContents,
        },
        {
          type: 'text',
          text: storeName,
          size: 'sm',
          color: '#666666',
          margin: 'sm',
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: weekdays.map((wd, i) => ({
            type: 'text',
            text: wd,
            size: 'xs',
            align: 'center',
            color: i === 0 ? '#EF4444' : i === 6 ? '#3B82F6' : '#374151',
            flex: 1,
            weight: 'bold',
          })) as messagingApi.FlexText[],
        },
        {
          type: 'separator',
          margin: 'sm',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            margin: 'md',
            contents: weeks,
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            spacing: 'md',
            contents: [
              { type: 'text', text: '◯出勤可', size: 'xs', color: '#22C55E', flex: 1 },
              { type: 'text', text: '△微妙', size: 'xs', color: '#EAB308', flex: 1 },
              { type: 'text', text: '×休み', size: 'xs', color: '#EF4444', flex: 1 },
            ],
          },
        ],
      },
    };
}

// カレンダー形式のFlex Messageを生成（単月表示用）
function buildCalendarFlexMessage(
  year: number,
  month: number,
  storeName: string,
  prefMap: Record<string, { status: string; time_slot: string | null }>,
  isConfirmed: boolean = false
): messagingApi.FlexMessage {
  return {
    type: 'flex',
    altText: `${month}月のシフト${isConfirmed ? '（確定）' : '希望'}`,
    contents: buildCalendarFlexBubble(year, month, storeName, prefMap, isConfirmed),
  };
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
            displayText: 'シフト希望を提出したい',
          },
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 843 },
          action: {
            type: 'postback',
            data: 'action=view_preferences',
            displayText: 'シフト希望を確認する',
          },
        },
        {
          bounds: { x: 0, y: 843, width: 1250, height: 843 },
          action: {
            type: 'postback',
            data: 'action=change_store',
            displayText: '店舗を切り替える',
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