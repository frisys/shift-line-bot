// app/api/debug-env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    // LINE関連
    LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET || 'undefined',
    LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'undefined',
    
    // Supabase関連（念のため）
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '存在する' : 'undefined',
    
    // その他よく使うもの
    NODE_ENV: process.env.NODE_ENV,
    TZ: process.env.TZ,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    
    // 全部まとめて（非公開情報はマスク）
    allEnvKeys: Object.keys(process.env),
  });
}