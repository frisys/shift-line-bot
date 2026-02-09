// app/api/test-date/route.ts
export async function GET() {
  const now = new Date();
  return Response.json({
    utc: now.toISOString(),
    local: now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    timezone: process.env.TZ,
  });
}