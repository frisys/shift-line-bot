import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getWeekStart, getWeekDays, formatDateJa } from '@/utils/date';

dayjs.extend(utc);
dayjs.extend(timezone);

// JST での日付文字列に変換するヘルパー
function toJstDate(d: Date): string {
  return dayjs(d).tz('Asia/Tokyo').format('YYYY-MM-DD');
}

describe('getWeekStart', () => {
  it('月曜入力 → その週の日曜を返す', () => {
    const monday = new Date('2026-06-01T12:00:00+09:00');
    expect(toJstDate(getWeekStart(monday))).toBe('2026-05-31');
  });

  it('日曜入力 → 当日を返す', () => {
    const sunday = new Date('2026-05-31T12:00:00+09:00');
    expect(toJstDate(getWeekStart(sunday))).toBe('2026-05-31');
  });

  it('土曜入力 → 週頭の日曜を返す', () => {
    const saturday = new Date('2026-06-06T12:00:00+09:00');
    expect(toJstDate(getWeekStart(saturday))).toBe('2026-05-31');
  });
});

describe('getWeekDays', () => {
  it('7要素の YYYY-MM-DD 配列を返す', () => {
    const weekStart = getWeekStart(new Date('2026-05-31T12:00:00+09:00'));
    const result = getWeekDays(weekStart);
    expect(result).toHaveLength(7);
    expect(result[0]).toBe('2026-05-31');
    expect(result[6]).toBe('2026-06-06');
  });

  it('各要素が YYYY-MM-DD 形式である', () => {
    const weekStart = getWeekStart(new Date('2026-05-31T12:00:00+09:00'));
    getWeekDays(weekStart).forEach(day =>
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    );
  });
});

describe('formatDateJa', () => {
  it('YYYY-MM-DD 文字列を M/D (曜日) 形式で返す', () => {
    const result = formatDateJa('2026-06-01');
    expect(result).toMatch(/^6\/1 \(\w+\)$/);
  });
});
