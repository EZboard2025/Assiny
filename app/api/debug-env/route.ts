import { NextResponse } from 'next/server'

export async function GET() {
  // NUNCA faça isso em produção! Apenas para debug
  return NextResponse.json({
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    supabaseUrlFirst10: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) || 'undefined',
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL || 'false'
  })
}