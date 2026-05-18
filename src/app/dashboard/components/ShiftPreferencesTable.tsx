// components/ShiftPreferencesTable.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ShiftPreference, Store } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface OptimizeAssignment {
  employee_id: string;
  date: string;
  shift_type: string;
}

interface OptimizeResult {
  assignments: OptimizeAssignment[] | null;
  score: number | null;
  detail: {
    coverage: number;
    fairness: number;
    consecutive: number;
    preference: number;
  } | null;
}

interface ShiftPreferencesTableProps {
  preferences: ShiftPreference[];
  store: Store | null;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function ShiftPreferencesTable({ preferences, store }: ShiftPreferencesTableProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<'preferences' | 'result'>('preferences');
  const [editedAssignments, setEditedAssignments] = useState<OptimizeAssignment[] | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeCell, setActiveCell] = useState<{
    staffName: string; date: string; top: number; left: number;
  } | null>(null);

  // 当月の日付配列を生成
  const monthDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      days.push(`${year}-${mm}-${dd}`);
    }
    return days;
  }, [year, month]);

  // スタッフごとに希望をマップ（当月のみ）
  const groupedByStaff = useMemo(() => {
    const map: Record<string, Record<string, ShiftPreference>> = {};
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    preferences
      .filter(p => p.shift_date.startsWith(prefix))
      .forEach(p => {
        const name = p.profiles?.name || p.user_id.substring(0, 8) + '...';
        if (!map[name]) map[name] = {};
        map[name][p.shift_date] = p;
      });
    return map;
  }, [preferences, year, month]);

  // user_id → name マップ（最適化結果の表示用）
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    preferences.forEach(p => {
      if (p.profiles?.name) map[p.user_id] = p.profiles.name;
    });
    return map;
  }, [preferences]);

  const staffNames = Object.keys(groupedByStaff);

  // 保存済みシフト確定結果を取得・復元
  const loadSavedConfirmation = useCallback(async () => {
    if (!store?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    try {
      const res = await fetch(
        `/api/stores/${store.id}/shift-confirmations?year_month=${yearMonth}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) return;
      const { confirmation } = await res.json();
      if (confirmation?.assignments) {
        setOptimizeResult({
          assignments: confirmation.assignments,
          score: confirmation.score ?? null,
          detail: confirmation.detail ?? null,
        });
      } else {
        setOptimizeResult(null);
      }
    } catch {
      // 取得失敗は無視（初回など）
    }
  }, [store?.id, year, month]);

  useEffect(() => {
    loadSavedConfirmation();
  }, [loadSavedConfirmation]);

  // optimizeResult が更新されたら編集用コピーを同期
  useEffect(() => {
    setEditedAssignments(optimizeResult?.assignments ?? null);
    setHasUnsavedChanges(false);
    setActiveCell(null);
  }, [optimizeResult]);

  const saveConfirmation = async (result: OptimizeResult) => {
    if (!store?.id || !result.assignments) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    await fetch(`/api/stores/${store.id}/shift-confirmations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        year_month: yearMonth,
        assignments: result.assignments,
        score: result.score,
        detail: result.detail,
      }),
    });
  };

  const handlePrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const getDayNum = (date: string) => new Date(date + 'T00:00:00+09:00').getDate();

  const getWeekdayLabel = (date: string) => {
    const day = new Date(date + 'T00:00:00+09:00').getDay();
    return ['日', '月', '火', '水', '木', '金', '土'][day];
  };

  const getDayStyle = (date: string) => {
    const day = new Date(date + 'T00:00:00+09:00').getDay();
    if (day === 0) return 'text-red-500';
    if (day === 6) return 'text-blue-500';
    return 'text-gray-500';
  };

  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getDateHeaderBg = (date: string) => {
    const day = new Date(date + 'T00:00:00+09:00').getDay();
    if (day === 0) return 'bg-red-50';
    if (day === 6) return 'bg-blue-50';
    return 'bg-gray-50';
  };

  const getDateCellClass = (date: string, isActive: boolean) => {
    if (isActive) return 'bg-blue-100';
    const day = new Date(date + 'T00:00:00+09:00').getDay();
    if (day === 0) return 'bg-red-50 hover:bg-red-100';
    if (day === 6) return 'bg-blue-50 hover:bg-blue-100';
    return 'hover:bg-gray-100';
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    setOptimizeError(null);

    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthPrefs = preferences.filter(p => p.shift_date.startsWith(prefix) && p.status !== 'no');

    if (monthPrefs.length === 0) {
      setOptimizeError('この月の出勤可能なシフト希望がありません');
      setOptimizing(false);
      return;
    }

    // availabilities 構築
    const availabilities = monthPrefs.map(p => ({
      employee_id: p.user_id,
      date: p.shift_date,
      shift_type: p.time_slot ?? 'DAY',
      preference: p.status === 'ok' ? 2 : 1,
    }));

    // アベイラビリティを日付×勤務区分でインデックス化（キャップ計算用）
    const dateShiftTypes: Record<string, Set<string>> = {};
    const availableCount: Record<string, Record<string, number>> = {};
    availabilities.forEach(a => {
      if (!dateShiftTypes[a.date]) dateShiftTypes[a.date] = new Set();
      dateShiftTypes[a.date].add(a.shift_type);
      if (!availableCount[a.date]) availableCount[a.date] = {};
      availableCount[a.date][a.shift_type] = (availableCount[a.date][a.shift_type] ?? 0) + 1;
    });

    // daily_requirements 構築: エンジンの期待する { "YYYY-MM-DD": { "<勤務区分>": <必要人数> } } 形式
    const daily_requirements: Record<string, Record<string, number>> = {};
    for (const date of monthDays) {
      const dayIndex = new Date(date + 'T00:00:00+09:00').getDay();
      const weekdayKey = WEEKDAY_KEYS[dayIndex];
      const dayRequired = store?.required_staff?.[weekdayKey];

      if (dayRequired !== null && dayRequired !== undefined && typeof dayRequired === 'object') {
        // 新形式: 勤務区分ごとの必要人数をそのまま使用
        const dateReqs: Record<string, number> = {};
        for (const [slot, count] of Object.entries(dayRequired as Record<string, number>)) {
          if (count <= 0) continue;
          const available = availableCount[date]?.[slot] ?? 0;
          // 出勤可能人数を超えるとソルバーが infeasible になるためキャップ（当日アベイラビリティ0の場合はそのまま渡す）
          dateReqs[slot] = available > 0 ? Math.min(count, available) : count;
        }
        if (Object.keys(dateReqs).length > 0) daily_requirements[date] = dateReqs;
      } else if (typeof dayRequired === 'number' && dayRequired > 0) {
        // 旧形式: 曜日合計をアベイラビリティのある勤務区分で均等分配
        const shiftTypes = dateShiftTypes[date];
        if (shiftTypes) {
          const perShift = Math.max(1, Math.ceil(dayRequired / shiftTypes.size));
          const dateReqs: Record<string, number> = {};
          for (const shift_type of shiftTypes) {
            const available = availableCount[date]?.[shift_type] ?? 1;
            dateReqs[shift_type] = Math.min(perShift, available);
          }
          daily_requirements[date] = dateReqs;
        }
      }
    }

    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilities, daily_requirements, required_shifts: [] }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.detail
          ? (Array.isArray(errBody.detail)
              ? errBody.detail.map((d: { loc?: unknown[]; msg?: string }) =>
                  `${(d.loc ?? []).join('.')}: ${d.msg ?? ''}`
                ).join(' / ')
              : String(errBody.detail))
          : res.status;
        throw new Error(`最適化エラー: ${detail}`);
      }
      const data: OptimizeResult = await res.json();
      setOptimizeResult(data);
      setInnerTab('result');
      await saveConfirmation(data);
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : '最適化に失敗しました');
    } finally {
      setOptimizing(false);
    }
  };

  // 最適化結果をスタッフ×日付グリッドに変換（editedAssignments ベース）
  const assignmentGrid = useMemo(() => {
    if (!editedAssignments) return null;
    const grid: Record<string, Record<string, string>> = {};
    editedAssignments.forEach(a => {
      const name = userNameMap[a.employee_id] || a.employee_id;
      if (!grid[name]) grid[name] = {};
      grid[name][a.date] = a.shift_type;
    });
    return grid;
  }, [editedAssignments, userNameMap]);

  // 表示名 → employee_id 逆引きマップ
  const nameToEmployeeId = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(userNameMap).forEach(([id, name]) => { map[name] = id; });
    return map;
  }, [userNameMap]);

  const handleCellEdit = (staffName: string, date: string, shiftType: string) => {
    const employeeId = nameToEmployeeId[staffName] ?? staffName;
    setEditedAssignments(prev => {
      if (!prev) return prev;
      if (shiftType === '') {
        return prev.filter(a => !(a.employee_id === employeeId && a.date === date));
      }
      const exists = prev.some(a => a.employee_id === employeeId && a.date === date);
      if (exists) {
        return prev.map(a =>
          a.employee_id === employeeId && a.date === date ? { ...a, shift_type: shiftType } : a
        );
      }
      return [...prev, { employee_id: employeeId, date, shift_type: shiftType }];
    });
    setHasUnsavedChanges(true);
  };

  const handleCellClick = (staffName: string, date: string, e: React.MouseEvent<HTMLTableCellElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // 画面右端にはみ出さないよう左位置を調整
    const popupWidth = 96;
    const left = Math.min(rect.left, window.innerWidth - popupWidth - 8);
    setActiveCell({ staffName, date, top: rect.bottom + 4, left });
  };

  const handleSaveEdits = async () => {
    if (!editedAssignments) return;
    setSaving(true);
    const result: OptimizeResult = {
      assignments: editedAssignments,
      score: optimizeResult?.score ?? null,
      detail: optimizeResult?.detail ?? null,
    };
    await saveConfirmation(result);
    setOptimizeResult(result);
    setHasUnsavedChanges(false);
    setSaving(false);
  };

  // 日付×勤務区分ごとのアサイン人数
  const summaryCounts = useMemo(() => {
    if (!assignmentGrid) return null;
    const counts: Record<string, Record<string, number>> = {};
    Object.values(assignmentGrid).forEach(dateMap => {
      Object.entries(dateMap).forEach(([date, shiftType]) => {
        if (!counts[date]) counts[date] = {};
        counts[date][shiftType] = (counts[date][shiftType] ?? 0) + 1;
      });
    });
    return counts;
  }, [assignmentGrid]);

  // 全勤務区分の一覧（登場順）
  const allShiftTypes = useMemo(() => {
    if (!assignmentGrid) return [];
    const seen = new Set<string>();
    Object.values(assignmentGrid).forEach(dateMap => {
      Object.values(dateMap).forEach(st => seen.add(st));
    });
    return Array.from(seen);
  }, [assignmentGrid]);

  // 日付×勤務区分ごとの必要人数（store.required_staff の新形式のみ対応）
  const requiredCountMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};
    monthDays.forEach(date => {
      const dayIndex = new Date(date + 'T00:00:00+09:00').getDay();
      const weekdayKey = WEEKDAY_KEYS[dayIndex];
      const dayVal = store?.required_staff?.[weekdayKey];
      map[date] = {};
      allShiftTypes.forEach(st => {
        if (dayVal !== undefined && dayVal !== null && typeof dayVal === 'object') {
          const v = (dayVal as Record<string, number>)[st];
          map[date][st] = v ?? null;
        } else {
          map[date][st] = null;
        }
      });
    });
    return map;
  }, [store, monthDays, allShiftTypes]);

  // スタッフ別月間集計（出勤日数・区分内訳・希望充足率・最大連勤）
  const staffMonthlySummary = useMemo(() => {
    if (!assignmentGrid) return [];
    return Object.entries(assignmentGrid).map(([name, dateMap]) => {
      const total = Object.keys(dateMap).length;
      const byType: Record<string, number> = {};
      Object.values(dateMap).forEach(st => { byType[st] = (byType[st] ?? 0) + 1; });

      const staffPrefs = groupedByStaff[name] ?? {};
      const eligibleDates = Object.entries(staffPrefs)
        .filter(([, p]) => p.status !== 'no')
        .map(([date]) => date);
      const satisfied = eligibleDates.filter(date => !!dateMap[date]).length;
      const satisfactionRate = eligibleDates.length > 0
        ? Math.round((satisfied / eligibleDates.length) * 100)
        : null;

      const sortedDates = Object.keys(dateMap).sort();
      let maxConsecutive = sortedDates.length > 0 ? 1 : 0;
      let currentRun = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1] + 'T00:00:00+09:00');
        const curr = new Date(sortedDates[i] + 'T00:00:00+09:00');
        if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
          currentRun++;
          if (currentRun > maxConsecutive) maxConsecutive = currentRun;
        } else {
          currentRun = 1;
        }
      }

      return { name, total, byType, satisfactionRate, maxConsecutive };
    }).sort((a, b) => b.total - a.total);
  }, [assignmentGrid, groupedByStaff]);

  const handleExportPDF = () => {
    if (!assignmentGrid) return;

    const title = `シフト表 ${year}年${month + 1}月`;

    const headerRow = `<tr>
      <th style="padding:6px 10px;text-align:left;border:1px solid #d1d5db;background:#f9fafb;min-width:100px;font-size:12px;">スタッフ</th>
      ${monthDays.map(date => {
        const day = new Date(date + 'T00:00:00+09:00').getDay();
        const color = day === 0 ? '#ef4444' : day === 6 ? '#3b82f6' : '#374151';
        const wd = ['日','月','火','水','木','金','土'][day];
        return `<th style="padding:4px 2px;text-align:center;border:1px solid #d1d5db;background:#f9fafb;min-width:30px;font-size:11px;color:${color};">
          <div style="font-weight:700;">${new Date(date + 'T00:00:00+09:00').getDate()}</div>
          <div style="font-size:9px;">${wd}</div>
        </th>`;
      }).join('')}
    </tr>`;

    const bodyRows = Object.entries(assignmentGrid).map(([name, dateMap]) => `
      <tr>
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:12px;font-weight:500;white-space:nowrap;">${name}</td>
        ${monthDays.map(date => {
          const shiftType = dateMap[date];
          return shiftType
            ? `<td style="padding:4px 2px;border:1px solid #d1d5db;text-align:center;">
                <span style="display:inline-block;padding:2px 3px;border-radius:3px;background:#dcfce7;color:#166534;font-weight:600;font-size:9px;white-space:nowrap;">${shiftType}</span>
              </td>`
            : `<td style="padding:4px 2px;border:1px solid #d1d5db;text-align:center;color:#d1d5db;font-size:11px;">-</td>`;
        }).join('')}
      </tr>`).join('');

    // 勤務区分別人数サマリー行（PDF用）
    const summaryBgColors = ['#dbeafe','#dcfce7','#fef9c3','#fce7f3','#ede9fe','#ffedd5'];
    const summaryTextColors = ['#1e40af','#166534','#854d0e','#9d174d','#5b21b6','#9a3412'];
    const summaryRows = allShiftTypes.map((st, i) => {
      const bg = summaryBgColors[i % summaryBgColors.length];
      const fg = summaryTextColors[i % summaryTextColors.length];
      return `<tr>
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;white-space:nowrap;background:${bg};color:${fg};">${st}</td>
        ${monthDays.map(date => {
          const count = summaryCounts?.[date]?.[st] ?? 0;
          return count > 0
            ? `<td style="padding:4px 2px;border:1px solid #d1d5db;text-align:center;background:${bg};">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${fg};color:#fff;font-size:10px;font-weight:700;">${count}</span>
              </td>`
            : `<td style="padding:4px 2px;border:1px solid #d1d5db;text-align:center;background:${bg};color:#d1d5db;font-size:10px;">-</td>`;
        }).join('')}
      </tr>`;
    }).join('');

    const totalRow = `<tr style="background:#f1f5f9;">
      <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;white-space:nowrap;color:#374151;">合計</td>
      ${monthDays.map(date => {
        const total = Object.values(summaryCounts?.[date] ?? {}).reduce((a, b) => a + b, 0);
        return total > 0
          ? `<td style="padding:4px 2px;border:1px solid #d1d5db;text-align:center;font-size:12px;font-weight:700;color:#111827;">${total}</td>`
          : `<td style="padding:4px 2px;border:1px solid #d1d5db;text-align:center;color:#d1d5db;font-size:10px;">-</td>`;
      }).join('')}
    </tr>`;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    @media print {
      body { padding: 10px; }
      @page { margin: 10mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div style="overflow-x:auto;">
    <table>${headerRow}${bodyRows}</table>
  </div>
  <div style="margin-top:20px;">
    <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #e5e7eb;">勤務区分別人数</div>
    <div style="overflow-x:auto;">
      <table>${headerRow}${summaryRows}${totalRow}</table>
    </div>
  </div>
  <div style="margin-top:12px;font-size:10px;color:#9ca3af;text-align:right;">出力日時: ${new Date().toLocaleString('ja-JP')}</div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1100,height=750');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <>
    {/* コントロール */}
    <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors text-sm"
        >
          ← 前月
        </button>
        <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center">
          {year}年{month + 1}月
        </span>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors text-sm"
        >
          次月 →
        </button>
        <button
          onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
          disabled={isCurrentMonth}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isCurrentMonth
              ? 'bg-gray-400 cursor-not-allowed text-gray-600'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          今月に戻る
        </button>
      </div>
      <button
        onClick={handleOptimize}
        disabled={optimizing}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          optimizing
            ? 'bg-gray-400 cursor-not-allowed text-gray-600'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {optimizing ? '最適化中...' : 'シフトを作成'}
      </button>
    </div>

    {/* 最適化エラー */}
    {optimizeError && (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {optimizeError}
      </div>
    )}

    {/* 内部タブ */}
    <div className="flex border-b border-gray-200 mb-4">
      <button
        onClick={() => setInnerTab('preferences')}
        className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
          innerTab === 'preferences'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        シフト希望
      </button>
      <button
        onClick={() => setInnerTab('result')}
        className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
          innerTab === 'result'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        シフト作成結果
        {optimizeResult && (
          <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-green-500" />
        )}
      </button>
    </div>

    {/* シフト希望タブ */}
    {innerTab === 'preferences' && (
    <section className="mb-10">
      {staffNames.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          この月の希望がありません
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20 min-w-[120px]">
                  スタッフ
                </th>
                {monthDays.map(date => (
                  <th
                    key={date}
                    className={`px-1 py-2 text-center text-xs font-medium min-w-[36px] ${getDayStyle(date)}`}
                  >
                    <div className="font-bold">{getDayNum(date)}</div>
                    <div className="text-[10px]">{getWeekdayLabel(date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffNames.map(name => (
                <tr key={name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                    {name}
                  </td>
                  {monthDays.map(date => {
                    const pref = groupedByStaff[name]?.[date];

                    if (!pref) {
                      return (
                        <td key={date} className="px-1 py-2 text-center text-gray-300 text-xs">
                          -
                        </td>
                      );
                    }

                    let badgeClass = '';
                    let symbol = '';
                    switch (pref.status) {
                      case 'ok':
                        badgeClass = 'bg-green-100 text-green-800';
                        symbol = '◯';
                        break;
                      case 'maybe':
                        badgeClass = 'bg-yellow-100 text-yellow-800';
                        symbol = '△';
                        break;
                      case 'no':
                        badgeClass = 'bg-red-100 text-red-800';
                        symbol = '×';
                        break;
                    }

                    return (
                      <td key={date} className="px-1 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5 relative group">
                          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${badgeClass}`}>
                            {symbol}
                          </span>
                          {pref.time_slot && (
                            <span className="text-[10px] text-gray-500 leading-none">
                              {pref.time_slot}
                            </span>
                          )}
                          {pref.note && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
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
    )}

    {/* シフト作成結果タブ */}
    {innerTab === 'result' && (
      <section className="mb-10">
        {!optimizeResult ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            「シフトを作成」ボタンを押して結果を生成してください
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {optimizeResult.score !== null && optimizeResult.detail && (
                  <>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      総合 {optimizeResult.score}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                      カバ {optimizeResult.detail.coverage}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                      公平 {optimizeResult.detail.fairness}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                      連勤 {optimizeResult.detail.consecutive}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
                      希望 {optimizeResult.detail.preference}
                    </span>
                  </>
                )}
              </div>
              {assignmentGrid && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditedAssignments(optimizeResult?.assignments ?? null); setHasUnsavedChanges(false); }}
                    disabled={!hasUnsavedChanges}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      hasUnsavedChanges
                        ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        : 'border-gray-200 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    元に戻す
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    disabled={!hasUnsavedChanges || saving}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors ${
                      hasUnsavedChanges && !saving
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  >
                    PDF出力
                  </button>
                </div>
              )}
            </div>
            {optimizeResult.assignments === null ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                解が見つかりませんでした
              </div>
            ) : assignmentGrid ? (
              <>
              <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm max-h-[calc(100vh-320px)] min-h-[300px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 top-0 bg-gray-50 z-30 min-w-[120px] border-r border-b border-gray-300">
                        スタッフ
                      </th>
                      {monthDays.map(date => (
                        <th
                          key={date}
                          className={`px-1 py-2 text-center text-xs font-medium min-w-[36px] sticky top-0 z-20 border-b border-gray-200 ${getDayStyle(date)} ${getDateHeaderBg(date)}`}
                        >
                          <div className={`font-bold ${date === todayDateStr ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[11px]' : ''}`}>
                            {getDayNum(date)}
                          </div>
                          <div className="text-[10px]">{getWeekdayLabel(date)}</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap sticky top-0 bg-gray-50 z-20 border-l-2 border-b border-gray-400 min-w-[64px]">
                        出勤日数
                      </th>
                      {allShiftTypes.map(st => (
                        <th key={st} className="px-3 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap sticky top-0 bg-gray-50 z-20 border-l border-b border-gray-200 min-w-[52px]">
                          {st}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap sticky top-0 bg-gray-50 z-20 border-l border-b border-gray-200 min-w-[72px]">
                        希望充足率
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap sticky top-0 bg-gray-50 z-20 border-l border-b border-gray-200 min-w-[64px]">
                        最大連勤
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(assignmentGrid).map(([name, dateMap]) => {
                      const summary = staffMonthlySummary.find(s => s.name === name);
                      const rateColor = summary?.satisfactionRate === null || summary?.satisfactionRate === undefined
                        ? 'text-gray-400'
                        : summary.satisfactionRate >= 80 ? 'text-green-600'
                        : summary.satisfactionRate >= 60 ? 'text-yellow-600'
                        : 'text-red-600';
                      const consecClass = (summary?.maxConsecutive ?? 0) >= 7 ? 'text-red-600 font-bold'
                        : (summary?.maxConsecutive ?? 0) >= 5 ? 'text-orange-500 font-semibold'
                        : 'text-gray-600';
                      return (
                        <tr key={name} className="group hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-1 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-300">
                            {name}
                          </td>
                          {monthDays.map(date => {
                            const shiftType = dateMap[date];
                            const isActive = activeCell?.staffName === name && activeCell?.date === date;
                            return (
                              <td
                                key={date}
                                onClick={e => handleCellClick(name, date, e)}
                                className={`px-1 py-1 text-center cursor-pointer transition-colors ${getDateCellClass(date, isActive)}`}
                              >
                                {shiftType ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 leading-tight whitespace-nowrap">
                                    {shiftType}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs select-none opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-1 text-center text-sm font-bold text-gray-800 border-l-2 border-gray-400">
                            {summary?.total ?? 0}日
                          </td>
                          {allShiftTypes.map(st => (
                            <td key={st} className="px-3 py-1 text-center text-sm text-gray-600 border-l border-gray-200">
                              {summary?.byType[st] ?? 0}
                            </td>
                          ))}
                          <td className={`px-3 py-1 text-center text-sm font-semibold border-l border-gray-200 ${rateColor}`}>
                            {summary?.satisfactionRate !== null && summary?.satisfactionRate !== undefined ? `${summary.satisfactionRate}%` : '-'}
                          </td>
                          <td className={`px-3 py-1 text-center text-sm border-l border-gray-200 ${consecClass}`}>
                            {(summary?.maxConsecutive ?? 0) > 0 ? `${summary?.maxConsecutive}日` : '-'}
                            {(summary?.maxConsecutive ?? 0) >= 5 && <span className="ml-1 text-[10px]">⚠️</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300">
                    <tr className="bg-orange-50">
                      <td className="px-4 py-1.5 text-xs font-semibold text-orange-600 whitespace-nowrap sticky left-0 bg-orange-50 z-10 border-r border-gray-200">
                        不足日
                      </td>
                      {monthDays.map(date => {
                        const isShortage = Object.entries(requiredCountMap[date] ?? {}).some(([st, req]) =>
                          req !== null && req > 0 && (summaryCounts?.[date]?.[st] ?? 0) < req
                        );
                        return (
                          <td key={date} className="px-1 py-1.5 text-center">
                            {isShortage ? (
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">!</span>
                            ) : (
                              <span className="text-gray-200 text-[10px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td colSpan={allShiftTypes.length + 3} className="border-l-2 border-gray-400" />
                    </tr>
                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                      <td colSpan={monthDays.length + 1} className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50">
                        勤務区分別人数
                      </td>
                      <td colSpan={allShiftTypes.length + 3} className="border-l-2 border-gray-400" />
                    </tr>
                    {allShiftTypes.map((st, i) => {
                      const rowBg = i % 2 === 0 ? 'bg-blue-50' : 'bg-indigo-50';
                      const stickyBg = i % 2 === 0 ? 'bg-blue-50' : 'bg-indigo-50';
                      const textColor = i % 2 === 0 ? 'text-blue-700' : 'text-indigo-700';
                      const defaultDot = i % 2 === 0 ? 'bg-blue-500' : 'bg-indigo-500';
                      return (
                        <tr key={st} className={rowBg}>
                          <td className={`px-4 py-1.5 text-xs font-semibold whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 ${stickyBg} ${textColor}`}>
                            {st}
                          </td>
                          {monthDays.map(date => {
                            const count = summaryCounts?.[date]?.[st] ?? 0;
                            const required = requiredCountMap[date]?.[st] ?? null;
                            const hasReq = required !== null && required > 0;
                            const status = hasReq
                              ? count < required! ? 'shortage' : count === required! ? 'exact' : 'surplus'
                              : null;
                            const dotColor = status === 'shortage' ? 'bg-red-500'
                              : status === 'exact' ? 'bg-blue-500'
                              : status === 'surplus' ? 'bg-green-500'
                              : defaultDot;
                            const reqColor = status === 'shortage' ? 'text-red-500'
                              : status === 'exact' ? 'text-blue-500'
                              : 'text-green-600';
                            return (
                              <td key={date} className="px-1 py-1.5 text-center">
                                {count > 0 ? (
                                  <div className="flex flex-col items-center gap-0">
                                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white ${dotColor}`}>
                                      {count}
                                    </span>
                                    {hasReq && (
                                      <span className={`text-[9px] leading-none mt-0.5 font-medium ${reqColor}`}>
                                        /{required}
                                      </span>
                                    )}
                                  </div>
                                ) : hasReq ? (
                                  <div className="flex flex-col items-center gap-0">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white bg-red-500">
                                      0
                                    </span>
                                    <span className="text-[9px] leading-none mt-0.5 font-medium text-red-500">
                                      /{required}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-[10px]">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td colSpan={allShiftTypes.length + 3} className="border-l-2 border-gray-400" />
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-100 border-t border-gray-200">
                      <td className="px-4 py-1.5 text-xs font-bold text-gray-700 sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                        合計
                      </td>
                      {monthDays.map(date => {
                        const total = Object.values(summaryCounts?.[date] ?? {}).reduce((a, b) => a + b, 0);
                        const totalReq = Object.values(requiredCountMap[date] ?? {})
                          .filter((v): v is number => v !== null)
                          .reduce((a, b) => a + b, 0);
                        const hasReq = totalReq > 0;
                        const totalStatus = hasReq
                          ? total < totalReq ? 'shortage' : total === totalReq ? 'exact' : 'surplus'
                          : null;
                        const totalColor = totalStatus === 'shortage' ? 'text-red-600'
                          : totalStatus === 'exact' ? 'text-blue-600'
                          : totalStatus === 'surplus' ? 'text-green-700'
                          : 'text-gray-800';
                        const totalReqColor = totalStatus === 'shortage' ? 'text-red-500'
                          : totalStatus === 'exact' ? 'text-blue-500'
                          : 'text-green-600';
                        return (
                          <td key={date} className="px-1 py-1.5 text-center">
                            {total > 0 ? (
                              <div className="flex flex-col items-center gap-0">
                                <span className={`text-xs font-bold ${totalColor}`}>{total}</span>
                                {hasReq && (
                                  <span className={`text-[9px] leading-none font-medium ${totalReqColor}`}>/{totalReq}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-[10px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td colSpan={allShiftTypes.length + 3} className="border-l-2 border-gray-400" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              </>
            ) : null}
          </>
        )}
      </section>
    )}
    {/* セル編集ポップオーバー */}
    {activeCell && (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveCell(null)}
        />
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 overflow-hidden"
          style={{ top: activeCell.top, left: activeCell.left, minWidth: 88 }}
        >
          <button
            onClick={() => { handleCellEdit(activeCell.staffName, activeCell.date, ''); setActiveCell(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 transition-colors"
          >
            なし
          </button>
          {(store?.time_slots ?? []).map(slot => (
            <button
              key={slot}
              onClick={() => { handleCellEdit(activeCell.staffName, activeCell.date, slot); setActiveCell(null); }}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {slot}
            </button>
          ))}
        </div>
      </>
    )}
    </>
  );
}
