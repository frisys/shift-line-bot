'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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

  // 過去シフト確認モーダル
  const pastMonthOptions = useMemo(() => {
    const options: { label: string; year: number; month: number }[] = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date(year, month - 1 - i, 1);
      options.push({ label: `${d.getFullYear()}年${d.getMonth() + 1}月`, year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return options;
  }, [year, month]);
  const [selectedPast, setSelectedPast] = useState(`${pastMonthOptions[0].year}-${pastMonthOptions[0].month}`);
  const [showPastModal, setShowPastModal] = useState(false);
  const [pastPreferences, setPastPreferences] = useState<Record<string, ShiftPreference>>({});
  const [pastLoading, setPastLoading] = useState(false);

  const openPastModal = async () => {
    const [y, m] = selectedPast.split('-').map(Number);
    setPastLoading(true);
    setShowPastModal(true);
    try {
      const res = await fetch(`/api/shift-preferences?userId=${userId}&storeId=${storeId}&year=${y}&month=${m}`);
      const json = await res.json();
      if (json.data) {
        const prefs: Record<string, ShiftPreference> = {};
        json.data.forEach((p: { shift_date: string; status: ShiftStatus; time_slot: string | null }) => {
          prefs[p.shift_date] = { date: p.shift_date, status: p.status, timeSlot: p.time_slot };
        });
        setPastPreferences(prefs);
      } else {
        setPastPreferences({});
      }
    } catch {
      setPastPreferences({});
    } finally {
      setPastLoading(false);
    }
  };

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

  // 店舗情報取得（API経由）
  useEffect(() => {
    if (!storeId) return;

    async function fetchStore() {
      try {
        const res = await fetch(`/api/stores/${storeId}`);
        const json = await res.json();
        if (json.data) setStoreName(json.data.name);
      } catch (err) {
        console.error('店舗情報取得エラー:', err);
      }
    }

    fetchStore();
  }, [storeId]);

  // 既存の希望を取得（API経由）
  useEffect(() => {
    if (!userId || !storeId) return;

    async function fetchExisting() {
      try {
        const res = await fetch(
          `/api/shift-preferences?userId=${userId}&storeId=${storeId}&year=${year}&month=${month}`
        );
        const json = await res.json();

        if (json.data) {
          const prefs: Record<string, ShiftPreference> = {};
          json.data.forEach((p: { shift_date: string; status: ShiftStatus; time_slot: string | null }) => {
            prefs[p.shift_date] = {
              date: p.shift_date,
              status: p.status,
              timeSlot: p.time_slot,
            };
          });
          setPreferences(prefs);
        }
      } catch (err) {
        console.error('希望取得エラー:', err);
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

  const handleReset = () => {
    setPreferences({});
    setSaved(false);
  };

  // その曜日の全日程が同一ステータスならそれを返す。バラバラならnull
  const getWeekdayUniformStatus = (weekdayIndex: number): ShiftStatus | null => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let found: ShiftStatus | null | undefined = undefined;
    for (let day = 1; day <= daysInMonth; day++) {
      if (new Date(year, month - 1, day).getDay() === weekdayIndex) {
        const s = preferences[getDateString(day)]?.status ?? null;
        if (found === undefined) found = s;
        else if (found !== s) return null;
      }
    }
    return found ?? null;
  };

  const handleToggleWeekday = (weekdayIndex: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const current = getWeekdayUniformStatus(weekdayIndex);
    const cycle: (ShiftStatus | null)[] = ['ok', 'maybe', 'no', null];
    const currentIdx = cycle.indexOf(current);
    // バラバラ(null返却だが cycle上は存在)→okから始める
    const nextStatus = cycle[(currentIdx + 1) % cycle.length];
    setPreferences((prev) => {
      const updated = { ...prev };
      for (let day = 1; day <= daysInMonth; day++) {
        if (new Date(year, month - 1, day).getDay() === weekdayIndex) {
          const dateStr = getDateString(day);
          if (nextStatus === null) {
            delete updated[dateStr];
          } else {
            updated[dateStr] = {
              date: dateStr,
              status: nextStatus,
              timeSlot: nextStatus === 'no' ? null : prev[dateStr]?.timeSlot || null,
            };
          }
        }
      }
      return updated;
    });
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

      const res = await fetch('/api/shift-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: records }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || '保存に失敗しました');
      }

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

  const PastModal = () => {
    const [y, m] = selectedPast.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-bold text-gray-900">{y}年{m}月 シフト希望</h2>
            <button
              onClick={() => setShowPastModal(false)}
              className="text-gray-500 text-2xl leading-none px-2"
            >
              ×
            </button>
          </div>
          <div className="p-4">
            {pastLoading ? (
              <p className="text-center text-gray-500 py-8">読み込み中...</p>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map((wd, i) => (
                    <div key={wd} className={`text-center text-sm font-bold py-1 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-800'}`}>{wd}</div>
                  ))}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                    {week.map((day, di) => {
                      if (day === null) return <div key={di} className="min-h-[56px]" />;
                      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const pref = pastPreferences[dateStr];
                      const dow = new Date(y, m - 1, day).getDay();
                      return (
                        <div key={di} className="min-h-[56px] flex flex-col border rounded-lg overflow-hidden">
                          <div className={`text-xs text-center py-0.5 ${dow === 0 ? 'bg-red-50 text-red-600' : dow === 6 ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-900'}`}>{day}</div>
                          <div className={`flex-1 flex flex-col items-center justify-center text-sm font-bold ${getStatusColor(pref?.status || null)}`}>
                            <span>{getStatusLabel(pref?.status || null)}</span>
                            {pref?.timeSlot && <span className="text-xs font-normal">{pref.timeSlot}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {Object.keys(pastPreferences).length === 0 && (
                  <p className="text-center text-gray-500 py-4">この月のシフト希望はありません</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
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
      {showPastModal && <PastModal />}
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <h1 className="text-xl font-bold text-gray-900 text-center">
            📅 {year}年{month}月 シフト希望
          </h1>
          {storeName && (
            <p className="text-center text-gray-700 mt-1">{storeName}</p>
          )}
          <div className="mt-3 flex gap-2 items-center">
            <select
              value={selectedPast}
              onChange={(e) => setSelectedPast(e.target.value)}
              className="flex-1 border rounded-lg px-2 py-2 text-sm text-gray-800"
            >
              {pastMonthOptions.map((o) => (
                <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={openPastModal}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg"
            >
              確認する
            </button>
          </div>
        </div>

        {/* 凡例 */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <p className="text-sm text-gray-800 mb-2">各日付をタップして希望を選択してください</p>
          <div className="flex justify-center gap-4 text-sm flex-wrap">
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
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded bg-gray-200 text-gray-700 flex items-center justify-center text-xs">−</span>
              <span className="text-gray-800">希望なし</span>
            </span>
          </div>
        </div>

        {/* カレンダー */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <p className="text-xs text-gray-500 mb-2">曜日をタップすると全日程を◯/解除できます</p>
          {/* 曜日ヘッダー（タップで一括◯/解除） */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((wd, i) => {
              const status = getWeekdayUniformStatus(i);
              const activeClass =
                status === 'ok' ? 'bg-green-500 text-white' :
                status === 'maybe' ? 'bg-yellow-400 text-black' :
                status === 'no' ? 'bg-red-500 text-white' :
                i === 0 ? 'text-red-600' :
                i === 6 ? 'text-blue-600' :
                'text-gray-800';
              return (
                <button
                  key={wd}
                  onClick={() => handleToggleWeekday(i)}
                  className={`text-center text-sm font-bold py-1 rounded transition-colors ${activeClass}`}
                >
                  {wd}
                </button>
              );
            })}
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

        {/* 保存・リセットボタン */}
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 py-4 rounded-xl font-bold text-lg shadow-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
          >
            🔄 リセット
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-2 w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-colors ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {saving ? '保存中...' : '💾 シフト希望を保存'}
          </button>
        </div>

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
