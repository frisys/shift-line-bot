// components/ShiftPreferencesTable.tsx
'use client';

import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ShiftPreference } from "@/types/shift-preference";

interface ShiftPreferencesTableProps {
  preferences: ShiftPreference[];
}

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault('Asia/Tokyo');

export default function ShiftPreferencesTable({ preferences }: ShiftPreferencesTableProps) {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9のミリ秒

  // 週の開始日（日曜始まり）
  const getWeekStart = (date: Date) => {
    const d = dayjs(date).tz('Asia/Tokyo');
    const day = d.day(); // 0=日曜
    const diff = day === 0 ? 0 : day;
    return d.subtract(diff, 'day').startOf('day').toDate()
  };

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = dayjs(new Date(currentWeekStart));
      const dateWithOffset = d.add(i, 'day').format('YYYY-MM-DD');
      days.push(dateWithOffset); // 'YYYY-MM-DD'
    }
    return days;
  }, [currentWeekStart]);

  // スタッフごとに希望をマップ
  const groupedByStaff = useMemo(() => {
    const map: Record<string, Record<string, ShiftPreference>> = {};
    preferences.forEach(p => {
      const name = p.profiles?.name || p.user_id.substring(0, 8) + '...';
      if (!map[name]) map[name] = {};
      map[name][p.shift_date] = p;
    });
    return map;
  }, [preferences]);

  const staffNames = Object.keys(groupedByStaff);

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const isCurrentWeek = () => {
    const todayStart = getWeekStart(new Date());
    const currentStart = getWeekStart(currentWeekStart);
    return currentStart.getTime() === todayStart.getTime();
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          シフト希望（週単位）
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            ← 前週
          </button>

          <button
            onClick={() => {
              const today = new Date();
              const weekStart = getWeekStart(today);
              console.log('今週の開始日:', weekStart.toLocaleDateString('ja-JP'));
              setCurrentWeekStart(weekStart);
            }}
            disabled={isCurrentWeek()}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isCurrentWeek()
                ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}          >
            今週に戻る
          </button>

          <button
            onClick={handleNextWeek}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            次週 →
          </button>
        </div>
      </div>

      {staffNames.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          この週の希望がありません
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 min-w-[120px]">
                  スタッフ
                </th>
                {weekDays.map(date => (
                  <th key={date} className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                    {new Date(date).toLocaleDateString('ja-JP', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {staffNames.map(name => (
                <tr key={name} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10">
                    {name}
                  </td>
                  {weekDays.map(date => {
                    const pref = groupedByStaff[name]?.[date];

                    if (!pref) {
                      return <td key={date} className="px-3 py-3 text-center text-gray-400 text-sm">-</td>;
                    }

                    let badgeClass = '';
                    let symbol = '';
                    switch (pref.status) {
                      case 'ok':
                        badgeClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                        symbol = '◯';
                        break;
                      case 'maybe':
                        badgeClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
                        symbol = '△';
                        break;
                      case 'no':
                        badgeClass = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
                        symbol = '×';
                        break;
                    }

                    return (
                      <td key={date} className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 relative group">
                          <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${badgeClass}`}>
                            {symbol}
                          </span>
                          {pref.time_slot && (
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {pref.time_slot}
                            </span>
                          )}

                          {/* noteのツールチップ */}
                          {pref.note && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                              <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap max-w-xs">
                                {pref.note}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}