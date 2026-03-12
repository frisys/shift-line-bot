import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// dayjs プラグイン初期化
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

// UTC+9 のミリ秒オフセット
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 指定日の週開始日（日曜）を取得
 */
export function getWeekStart(date: Date): Date {
  const d = dayjs(date).tz('Asia/Tokyo');
  const day = d.day(); // 0=日曜
  const diff = day === 0 ? 0 : day;
  return d.subtract(diff, 'day').startOf('day').toDate();
}

/**
 * 週開始日から7日分の日付配列を生成
 * @returns 'YYYY-MM-DD' 形式の日付配列
 */
export function getWeekDays(weekStart: Date): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = dayjs(weekStart);
    days.push(d.add(i, 'day').format('YYYY-MM-DD'));
  }
  return days;
}

/**
 * 日付を日本語表示形式にフォーマット
 */
export function formatDateJa(date: string | Date): string {
  return dayjs(date).format('M/D (ddd)');
}
