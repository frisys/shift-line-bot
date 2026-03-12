// 曜日の英語→日本語マッピング
export const WEEKDAY_MAP: Record<string, string> = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

// 週の曜日順（日曜始まり）
export const DAYS_ORDER = [
  { eng: 'sun', ja: '日' },
  { eng: 'mon', ja: '月' },
  { eng: 'tue', ja: '火' },
  { eng: 'wed', ja: '水' },
  { eng: 'thu', ja: '木' },
  { eng: 'fri', ja: '金' },
  { eng: 'sat', ja: '土' },
] as const;

// 英語曜日から日本語を取得
export function getJapaneseWeekday(eng: string): string {
  return WEEKDAY_MAP[eng.toLowerCase()] || eng;
}
