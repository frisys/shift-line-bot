// components/ShiftPreferencesTable.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ShiftPreference, Store, Staff } from '@/types';
import { supabase } from '@/lib/supabase/client';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableFooter from '@mui/material/TableFooter';
import Stack from '@mui/material/Stack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import PrintIcon from '@mui/icons-material/Print';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

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
  staff?: Staff[];
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function ShiftPreferencesTable({ preferences, store, staff = [] }: ShiftPreferencesTableProps) {
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
  const [anchorEl, setAnchorEl] = useState<HTMLTableCellElement | null>(null);
  const [popoverInfo, setPopoverInfo] = useState<{ staffName: string; date: string } | null>(null);

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

  // スタッフ名 → 時給マップ
  const staffNameToWage = useMemo(() => {
    const map: Record<string, number | null> = {};
    staff.forEach(s => {
      const name = userNameMap[s.line_user_id];
      if (name) map[name] = s.hourly_wage ?? null;
    });
    return map;
  }, [staff, userNameMap]);

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
    setAnchorEl(null);
    setPopoverInfo(null);
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

  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
    setAnchorEl(e.currentTarget);
    setPopoverInfo({ staffName, date });
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
    setPopoverInfo(null);
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
    * { box-sizing: border-box; margin: 0; padding: 0; overflow: visible; }
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
  <div style="overflow:visible;">
    <table>${headerRow}${bodyRows}</table>
  </div>
  <div style="margin-top:20px;">
    <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #e5e7eb;">勤務区分別人数</div>
    <div style="overflow:visible;">
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
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<ChevronLeftIcon />} onClick={handlePrevMonth}>
            前月
          </Button>
          <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80, textAlign: 'center' }}>
            {year}年{month + 1}月
          </Typography>
          <Button variant="outlined" size="small" endIcon={<ChevronRightIcon />} onClick={handleNextMonth}>
            次月
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TodayIcon />}
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            disabled={isCurrentMonth}
          >
            今月に戻る
          </Button>
        </Stack>
        <Button
          variant="contained"
          color="success"
          startIcon={optimizing ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
          onClick={handleOptimize}
          disabled={optimizing}
        >
          {optimizing ? '最適化中...' : 'シフトを作成'}
        </Button>
      </Stack>

      {/* 最適化エラー */}
      {optimizeError && (
        <Alert severity="error" sx={{ mb: 2 }}>{optimizeError}</Alert>
      )}

      {/* 内部タブ */}
      <Tabs
        value={innerTab}
        onChange={(_, v) => setInnerTab(v as 'preferences' | 'result')}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab value="preferences" label="シフト希望" />
        <Tab
          value="result"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              シフト作成結果
              {optimizeResult && (
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
              )}
            </Box>
          }
        />
      </Tabs>

      {/* シフト希望タブ */}
      {innerTab === 'preferences' && (
        <Box sx={{ mb: 5 }}>
          {staffNames.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <Typography color="text.secondary">この月の希望がありません</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell
                      sx={{
                        position: 'sticky', left: 0, bgcolor: 'grey.50', zIndex: 2,
                        minWidth: 120, fontWeight: 600, fontSize: 11,
                        textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em',
                      }}
                    >
                      スタッフ
                    </TableCell>
                    {monthDays.map(date => {
                      const day = new Date(date + 'T00:00:00+09:00').getDay();
                      return (
                        <TableCell
                          key={date}
                          align="center"
                          sx={{
                            minWidth: 36, px: 0.5, py: 1, fontSize: 11, fontWeight: 500,
                            color: day === 0 ? 'error.main' : day === 6 ? 'primary.main' : 'text.secondary',
                          }}
                        >
                          <Box sx={{ fontWeight: 700 }}>{getDayNum(date)}</Box>
                          <Box sx={{ fontSize: 10 }}>{getWeekdayLabel(date)}</Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {staffNames.map(name => (
                    <TableRow key={name} hover>
                      <TableCell
                        sx={{
                          position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1,
                          fontWeight: 500, whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </TableCell>
                      {monthDays.map(date => {
                        const pref = groupedByStaff[name]?.[date];
                        if (!pref) {
                          return (
                            <TableCell key={date} align="center" sx={{ px: 0.5 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                                <Box sx={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: 11 }}>
                                  -
                                </Box>
                                <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1, visibility: 'hidden' }}>　</Typography>
                              </Box>
                            </TableCell>
                          );
                        }
                        let chipColor: 'success' | 'warning' | 'error' = 'success';
                        let symbol = '◯';
                        if (pref.status === 'maybe') { chipColor = 'warning'; symbol = '△'; }
                        if (pref.status === 'no') { chipColor = 'error'; symbol = '×'; }
                        return (
                          <TableCell key={date} align="center" sx={{ px: 0.5 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                              {pref.note ? (
                                <Tooltip title={pref.note} placement="top">
                                  <Chip
                                    label={symbol}
                                    size="small"
                                    color={chipColor}
                                    variant="outlined"
                                    sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, cursor: 'default' }}
                                  />
                                </Tooltip>
                              ) : (
                                <Chip
                                  label={symbol}
                                  size="small"
                                  color={chipColor}
                                  variant="outlined"
                                  sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700 }}
                                />
                              )}
                              <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1, color: 'text.secondary', visibility: pref.time_slot ? 'visible' : 'hidden' }}>
                                {pref.time_slot || '　'}
                              </Typography>
                            </Box>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* シフト作成結果タブ */}
      {innerTab === 'result' && (
        <Box sx={{ mb: 5 }}>
          {!optimizeResult ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <Typography color="text.secondary">「シフトを作成」ボタンを押して結果を生成してください</Typography>
            </Paper>
          ) : (
            <>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  {optimizeResult.score !== null && optimizeResult.detail && (
                    <>
                      <Chip label={`総合 ${optimizeResult.score}`} size="small" color="primary" />
                      <Chip label={`カバ ${optimizeResult.detail.coverage}`} size="small" color="success" variant="outlined" />
                      <Chip label={`公平 ${optimizeResult.detail.fairness}`} size="small" color="secondary" variant="outlined" />
                      <Chip label={`連勤 ${optimizeResult.detail.consecutive}`} size="small" sx={{ bgcolor: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74' }} />
                      <Chip label={`希望 ${optimizeResult.detail.preference}`} size="small" sx={{ bgcolor: '#fefce8', color: '#854d0e', border: '1px solid #fde047' }} />
                    </>
                  )}
                </Stack>
                {assignmentGrid && (
                  <Stack direction="row" sx={{ gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UndoIcon />}
                      onClick={() => { setEditedAssignments(optimizeResult?.assignments ?? null); setHasUnsavedChanges(false); }}
                      disabled={!hasUnsavedChanges}
                    >
                      元に戻す
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                      onClick={handleSaveEdits}
                      disabled={!hasUnsavedChanges || saving}
                    >
                      {saving ? '保存中...' : '保存'}
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PrintIcon />}
                      onClick={handleExportPDF}
                      sx={{ bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } }}
                    >
                      印刷
                    </Button>
                    <Tooltip
                      title="PDFとして保存したい場合は、印刷画面の送信先で「PDFに保存」または「Microsoft Print to PDF」を選択してください"
                      placement="top"
                      arrow
                    >
                      <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled', cursor: 'default', ml: -0.5 }} />
                    </Tooltip>
                  </Stack>
                )}
              </Stack>

              {optimizeResult.assignments === null ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                  <Typography color="text.secondary" variant="body2">解が見つかりませんでした</Typography>
                </Paper>
              ) : assignmentGrid ? (
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ maxHeight: 'calc(100vh - 320px)', minHeight: 300, borderRadius: 2 }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{
                            position: 'sticky', left: 0, top: 0, zIndex: 4,
                            bgcolor: 'grey.50', minWidth: 120, fontWeight: 600, fontSize: 11,
                            textTransform: 'uppercase', color: 'text.secondary',
                            borderRight: '2px solid', borderColor: 'grey.300',
                          }}
                        >
                          スタッフ
                        </TableCell>
                        {monthDays.map(date => {
                          const day = new Date(date + 'T00:00:00+09:00').getDay();
                          const shortageSlots = Object.entries(requiredCountMap[date] ?? {})
                            .filter(([st, req]) => req !== null && req > 0 && (summaryCounts?.[date]?.[st] ?? 0) < req)
                            .map(([st, req]) => `${st}: ${summaryCounts?.[date]?.[st] ?? 0}/${req}人`);
                          const isShortage = shortageSlots.length > 0;
                          return (
                            <TableCell
                              key={date}
                              align="center"
                              sx={{
                                minWidth: 36, px: 0.5, py: 0.75, fontSize: 11,
                                color: day === 0 ? 'error.main' : day === 6 ? 'primary.main' : 'text.secondary',
                                bgcolor: day === 0 ? '#fef2f2' : day === 6 ? '#eff6ff' : 'grey.50',
                              }}
                            >
                              <Box sx={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                {isShortage && (
                                  <Tooltip
                                    title={
                                      <Box>
                                        {shortageSlots.map(s => <Box key={s} sx={{ fontSize: 11 }}>{s}</Box>)}
                                      </Box>
                                    }
                                    placement="top"
                                    arrow
                                  >
                                    <Box sx={{
                                      position: 'absolute', top: -4, right: -8,
                                      width: 14, height: 14, borderRadius: '50%',
                                      bgcolor: 'error.main', color: 'white',
                                      fontSize: 9, fontWeight: 700,
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'default', zIndex: 1,
                                    }}>
                                      !
                                    </Box>
                                  </Tooltip>
                                )}
                                <Box
                                  sx={date === todayDateStr ? {
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 20, height: 20, borderRadius: '50%', bgcolor: 'primary.main',
                                    color: 'white', fontSize: 11, fontWeight: 700,
                                  } : { fontWeight: 700 }}
                                >
                                  {getDayNum(date)}
                                </Box>
                                <Box sx={{ fontSize: 10 }}>{getWeekdayLabel(date)}</Box>
                              </Box>
                            </TableCell>
                          );
                        })}
                        <TableCell align="center" sx={{ minWidth: 64, fontWeight: 600, fontSize: 11, color: 'text.secondary', borderLeft: '2px solid', borderColor: 'grey.400', whiteSpace: 'nowrap', bgcolor: 'grey.50' }}>
                          出勤日数
                        </TableCell>
                        <TableCell align="center" sx={{ minWidth: 72, fontWeight: 600, fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', bgcolor: 'grey.50' }}>
                          希望充足率
                        </TableCell>
                        <TableCell align="center" sx={{ minWidth: 64, fontWeight: 600, fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', bgcolor: 'grey.50' }}>
                          最大連勤
                        </TableCell>
                        <TableCell align="center" sx={{ minWidth: 80, fontWeight: 600, fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', bgcolor: 'grey.50', '@media print': { display: 'none' } }}>
                          給与目安
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(assignmentGrid).map(([name, dateMap]) => {
                        const summary = staffMonthlySummary.find(s => s.name === name);
                        const rateColor = summary?.satisfactionRate === null || summary?.satisfactionRate === undefined
                          ? 'text.disabled'
                          : summary.satisfactionRate >= 80 ? 'success.main'
                          : summary.satisfactionRate >= 60 ? 'warning.main'
                          : 'error.main';
                        const consecFontWeight = (summary?.maxConsecutive ?? 0) >= 5 ? 700 : 400;
                        const consecColor = (summary?.maxConsecutive ?? 0) >= 7 ? 'error.main'
                          : (summary?.maxConsecutive ?? 0) >= 5 ? 'warning.main'
                          : 'text.secondary';
                        return (
                          <TableRow key={name} hover>
                            <TableCell
                              sx={{
                                position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1,
                                fontWeight: 500, whiteSpace: 'nowrap',
                                borderRight: '2px solid', borderColor: 'grey.300',
                              }}
                            >
                              {name}
                            </TableCell>
                            {monthDays.map(date => {
                              const shiftType = dateMap[date];
                              const isActive = popoverInfo?.staffName === name && popoverInfo?.date === date;
                              const day = new Date(date + 'T00:00:00+09:00').getDay();
                              const isVacation = !shiftType && groupedByStaff[name]?.[date]?.status === 'no';
                              return (
                                <TableCell
                                  key={date}
                                  align="center"
                                  onClick={e => handleCellClick(name, date, e)}
                                  sx={{
                                    px: 0.5, py: 0.5, cursor: 'pointer',
                                    bgcolor: isActive ? '#dbeafe'
                                      : day === 0 ? '#fef2f2'
                                      : day === 6 ? '#eff6ff'
                                      : 'transparent',
                                    '&:hover': {
                                      bgcolor: day === 0 ? '#fee2e2'
                                        : day === 6 ? '#dbeafe'
                                        : 'action.hover',
                                    },
                                  }}
                                >
                                  {shiftType ? (
                                    <Chip
                                      label={shiftType}
                                      size="small"
                                      sx={{ bgcolor: '#dcfce7', color: '#166534', height: 20, fontSize: 10, fontWeight: 600, '& .MuiChip-label': { px: 0.75 } }}
                                    />
                                  ) : isVacation ? (
                                    <Chip
                                      label="休暇希望"
                                      size="small"
                                      sx={{
                                        bgcolor: '#fee2e2', color: '#991b1b',
                                        height: 20, fontSize: 9, fontWeight: 600,
                                        '& .MuiChip-label': { px: 0.75 },
                                        '@media print': { display: 'none' },
                                      }}
                                    />
                                  ) : null}
                                </TableCell>
                              );
                            })}
                            <TableCell align="center" sx={{ fontWeight: 700, borderLeft: '2px solid', borderColor: 'grey.400' }}>
                              {summary && Object.keys(summary.byType).length > 0 ? (
                                <Tooltip
                                  title={
                                    <Box>
                                      {Object.entries(summary.byType).map(([st, cnt]) => (
                                        <Box key={st} sx={{ fontSize: 11 }}>{st}: {cnt}日</Box>
                                      ))}
                                    </Box>
                                  }
                                  placement="top"
                                  arrow
                                >
                                  <Box sx={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                    {summary.total}日
                                    <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                  </Box>
                                </Tooltip>
                              ) : (
                                <>{summary?.total ?? 0}日</>
                              )}
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600, color: rateColor, fontSize: 13 }}>
                              {summary?.satisfactionRate !== null && summary?.satisfactionRate !== undefined
                                ? `${summary.satisfactionRate}%` : '-'}
                            </TableCell>
                            <TableCell align="center" sx={{ color: consecColor, fontWeight: consecFontWeight, fontSize: 13 }}>
                              {(summary?.maxConsecutive ?? 0) > 0 ? `${summary?.maxConsecutive}日` : '-'}
                              {(summary?.maxConsecutive ?? 0) >= 5 && ' ⚠️'}
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: 13, whiteSpace: 'nowrap', '@media print': { display: 'none' } }}>
                              {(() => {
                                const wage = staffNameToWage[name];
                                if (wage == null || !summary?.total) return <Typography variant="body2" color="text.disabled">-</Typography>;
                                const est = wage * summary.total * 8;
                                return <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>¥{est.toLocaleString()}</Typography>;
                              })()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter sx={{ borderTop: '2px solid', borderColor: 'grey.300' }}>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell
                          colSpan={monthDays.length + 1}
                          sx={{ position: 'sticky', left: 0, bgcolor: 'grey.50', zIndex: 1, fontSize: 10, fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                          勤務区分別人数
                        </TableCell>
                        <TableCell colSpan={4} sx={{ borderLeft: '2px solid', borderColor: 'grey.400' }} />
                      </TableRow>
                      {allShiftTypes.map((st, i) => {
                        const rowBg = i % 2 === 0 ? '#eff6ff' : '#eef2ff';
                        const textColor = i % 2 === 0 ? '#1d4ed8' : '#4338ca';
                        const dotDefault = i % 2 === 0 ? '#3b82f6' : '#6366f1';
                        return (
                          <TableRow key={st} sx={{ bgcolor: rowBg }}>
                            <TableCell sx={{ position: 'sticky', left: 0, bgcolor: rowBg, zIndex: 1, fontSize: 11, fontWeight: 600, color: textColor, whiteSpace: 'nowrap' }}>
                              {st}
                            </TableCell>
                            {monthDays.map(date => {
                              const count = summaryCounts?.[date]?.[st] ?? 0;
                              const required = requiredCountMap[date]?.[st] ?? null;
                              const hasReq = required !== null && required > 0;
                              const status = hasReq ? count < required! ? 'shortage' : count === required! ? 'exact' : 'surplus' : null;
                              const dotColor = status === 'shortage' ? '#ef4444' : status === 'exact' ? '#3b82f6' : status === 'surplus' ? '#16a34a' : dotDefault;
                              const reqColor = status === 'shortage' ? 'error.main' : status === 'exact' ? 'primary.main' : 'success.main';
                              return (
                                <TableCell key={date} align="center" sx={{ px: 0.5, py: 0.75 }}>
                                  {count > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', bgcolor: dotColor, color: 'white', fontSize: 10, fontWeight: 700 }}>
                                        {count}
                                      </Box>
                                      {hasReq && <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1, mt: 0.25, fontWeight: 500, color: reqColor }}>/{required}</Typography>}
                                    </Box>
                                  ) : hasReq ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', bgcolor: 'error.main', color: 'white', fontSize: 10, fontWeight: 700 }}>0</Box>
                                      <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1, mt: 0.25, fontWeight: 500, color: 'error.main' }}>/{required}</Typography>
                                    </Box>
                                  ) : (
                                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10 }}>-</Typography>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell colSpan={4} sx={{ borderLeft: '2px solid', borderColor: 'grey.400' }} />
                          </TableRow>
                        );
                      })}
                      <TableRow sx={{ bgcolor: 'grey.100', borderTop: '1px solid', borderColor: 'grey.200' }}>
                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'grey.100', zIndex: 1, fontSize: 11, fontWeight: 700 }}>
                          合計
                        </TableCell>
                        {monthDays.map(date => {
                          const total = Object.values(summaryCounts?.[date] ?? {}).reduce((a, b) => a + b, 0);
                          const totalReq = Object.values(requiredCountMap[date] ?? {}).filter((v): v is number => v !== null).reduce((a, b) => a + b, 0);
                          const hasReq = totalReq > 0;
                          const totalStatus = hasReq ? total < totalReq ? 'shortage' : total === totalReq ? 'exact' : 'surplus' : null;
                          const totalColor = totalStatus === 'shortage' ? 'error.main' : totalStatus === 'exact' ? 'primary.main' : totalStatus === 'surplus' ? 'success.main' : 'text.primary';
                          return (
                            <TableCell key={date} align="center" sx={{ px: 0.5, py: 0.75 }}>
                              {total > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: totalColor }}>{total}</Typography>
                                  {hasReq && <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1, fontWeight: 500, color: totalColor }}>/{totalReq}</Typography>}
                                </Box>
                              ) : (
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10 }}>-</Typography>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell colSpan={4} sx={{ borderLeft: '2px solid', borderColor: 'grey.400' }} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              ) : null}
            </>
          )}
        </Box>
      )}

      {/* セル編集ポップオーバー */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 88, borderRadius: 2 } } }}
      >
        <MenuList dense>
          <MenuItem
            onClick={() => { if (popoverInfo) { handleCellEdit(popoverInfo.staffName, popoverInfo.date, ''); } handlePopoverClose(); }}
            sx={{ fontSize: 12, color: 'text.secondary' }}
          >
            なし
          </MenuItem>
          {(store?.time_slots ?? []).map(slot => (
            <MenuItem
              key={slot}
              onClick={() => { if (popoverInfo) { handleCellEdit(popoverInfo.staffName, popoverInfo.date, slot); } handlePopoverClose(); }}
              sx={{ fontSize: 12, fontWeight: 500 }}
            >
              {slot}
            </MenuItem>
          ))}
        </MenuList>
      </Popover>
    </>
  );
}
