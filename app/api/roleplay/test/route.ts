import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    hasApiKey: !!process.env.OPENAI_API_KEY,
    hasAssistantId: !!process.env.OPENAI_ASSISTANT_ID_ROLEPLAY,
    assistantId: process.env.OPENAI_ASSISTANT_ID_ROLEPLAY,
    apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    apiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) || 'not found'
  })
}