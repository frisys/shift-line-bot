'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { ShiftStatus } from '@/constants';

interface ShiftPreference {
  date: string;
  status: ShiftStatus | null;
  timeSlot: string | null;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function ShiftSelectContent() {
  const searchParams = useSearchParams();
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const userId = searchParams.get('userId') || '';
  const storeId = searchParams.get('storeId') || '';

  const [preferences, setPreferences] = useState<Record<string, ShiftPreference>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');

  // カレンダーデータ生成
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

    const days: (number | null)[] = [];

    // 月初の空白
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // 日付
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    // 週ごとに分割
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    return weeks;
  }, [year, month]);

  // 店舗情報取得
  useEffect(() => {
    if (!storeId) return;

    async function fetchStore() {
      const { data } = await supabase
        .from('stores')
        .select('name')
        .eq('id', storeId)
        .single();

      if (data) setStoreName(data.name);
    }

    fetchStore();
  }, [storeId]);

  // 既存の希望を取得
  useEffect(() => {
    if (!userId || !storeId) return;

    async function fetchExisting() {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

      const { data } = await supabase
        .from('shift_preferences')
        .select('shift_date, status, time_slot')
        .eq('user_id', userId)
        .eq('store_id', storeId)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate);

      if (data) {
        const prefs: Record<string, ShiftPreference> = {};
        data.forEach((p) => {
          prefs[p.shift_date] = {
            date: p.shift_date,
            status: p.status as ShiftStatus,
            timeSlot: p.time_slot,
          };
        });
        setPreferences(prefs);
      }
    }

    fetchExisting();
  }, [userId, storeId, year, month]);

  const getDateString = (day: number) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleStatusChange = (day: number, status: ShiftStatus | null) => {
    const dateStr = getDateString(day);
    setPreferences((prev) => ({
      ...prev,
      [dateStr]: {
        date: dateStr,
        status,
        timeSlot: status === 'no' ? null : prev[dateStr]?.timeSlot || null,
      },
    }));
    setSaved(false);
  };

  const handleTimeSlotChange = (day: number, timeSlot: string | null) => {
    const dateStr = getDateString(day);
    setPreferences((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        date: dateStr,
        timeSlot,
      },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!userId || !storeId) {
      setError('ユーザーIDまたは店舗IDが指定されていません');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const records = Object.values(preferences)
        .filter((p) => p.status !== null)
        .map((p) => ({
          user_id: userId,
          store_id: storeId,
          shift_date: p.date,
          status: p.status,
          time_slot: p.timeSlot,
        }));

      if (records.length === 0) {
        setError('シフト希望が選択されていません');
        setSaving(false);
        return;
      }

      const { error: upsertError } = await supabase
        .from('shift_preferences')
        .upsert(records, { onConflict: 'user_id,store_id,shift_date' });

      if (upsertError) throw upsertError;

      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: ShiftStatus | null) => {
    switch (status) {
      case 'ok':
        return 'bg-green-500 text-white';
      case 'maybe':
        return 'bg-yellow-400 text-black';
      case 'no':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const getStatusLabel = (status: ShiftStatus | null) => {
    switch (status) {
      case 'ok':
        return '◯';
      case 'maybe':
        return '△';
      case 'no':
        return '×';
      default:
        return '−';
    }
  };

  if (!userId || !storeId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <p className="text-red-600 font-bold">エラー</p>
          <p className="mt-2 text-gray-800">パラメータが不足しています</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <h1 className="text-xl font-bold text-gray-900 text-center">
            📅 {year}年{month}月 シフト希望
          </h1>
          {storeName && (
            <p className="text-center text-gray-700 mt-1">{storeName}</p>
          )}
        </div>

        {/* 凡例 */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <p className="text-sm text-gray-800 mb-2">各日付をタップして希望を選択してください</p>
          <div className="flex justify-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center text-xs">◯</span>
              <span className="text-gray-800">出勤可</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded bg-yellow-400 text-black flex items-center justify-center text-xs">△</span>
              <span className="text-gray-800">微妙</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded bg-red-500 text-white flex items-center justify-center text-xs">×</span>
              <span className="text-gray-800">休み</span>
            </span>
          </div>
        </div>

        {/* カレンダー */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className={`text-center text-sm font-bold py-1 ${
                  i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-800'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* 日付 */}
          {calendarData.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1 mb-1">
              {week.map((day, dayIdx) => {
                if (day === null) {
                  return <div key={dayIdx} className="min-h-[72px]" />;
                }

                const dateStr = getDateString(day);
                const pref = preferences[dateStr];
                const dayOfWeek = new Date(year, month - 1, day).getDay();
                const showTimeSlot = pref?.status === 'ok' || pref?.status === 'maybe';

                return (
                  <div
                    key={dayIdx}
                    className="min-h-[72px] flex flex-col border rounded-lg overflow-hidden"
                  >
                    {/* 日付 */}
                    <div
                      className={`text-xs text-center py-0.5 ${
                        dayOfWeek === 0
                          ? 'bg-red-50 text-red-600'
                          : dayOfWeek === 6
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-gray-50 text-gray-900'
                      }`}
                    >
                      {day}
                    </div>

                    {/* ステータスボタン */}
                    <button
                      onClick={() => {
                        const currentStatus = pref?.status;
                        const statuses: (ShiftStatus | null)[] = [null, 'ok', 'maybe', 'no'];
                        const currentIdx = statuses.indexOf(currentStatus || null);
                        const nextStatus = statuses[(currentIdx + 1) % statuses.length];
                        handleStatusChange(day, nextStatus);
                      }}
                      className={`flex-1 flex items-center justify-center text-base font-bold ${getStatusColor(
                        pref?.status || null
                      )}`}
                    >
                      {getStatusLabel(pref?.status || null)}
                    </button>

                    {/* 時間帯セレクト */}
                    {showTimeSlot && (
                      <select
                        value={pref?.timeSlot || ''}
                        onChange={(e) => handleTimeSlotChange(day, e.target.value || null)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs text-gray-900 bg-white border-t px-0.5 py-0.5 text-center"
                      >
                        <option value="">--</option>
                        <option value="早番">早番</option>
                        <option value="日勤">日勤</option>
                        <option value="遅番">遅番</option>
                        <option value="夜勤">夜勤</option>
                        <option value="フル">フル</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* 保存完了メッセージ */}
        {saved && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
            ✅ シフト希望を保存しました！LINEに戻って確認してください。
          </div>
        )}

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-colors ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {saving ? '保存中...' : '💾 シフト希望を保存'}
        </button>

        {/* 選択数サマリー */}
        <div className="mt-4 text-center text-sm text-gray-800">
          選択済み: ◯{Object.values(preferences).filter((p) => p.status === 'ok').length}日 /
          △{Object.values(preferences).filter((p) => p.status === 'maybe').length}日 /
          ×{Object.values(preferences).filter((p) => p.status === 'no').length}日
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
        <p className="text-gray-800">読み込み中...</p>
      </div>
    </div>
  );
}

export default function ShiftSelectPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ShiftSelectContent />
    </Suspense>
  );
}
