import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens, getGoogleEmail } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denial
    if (error) {
      console.warn('[Calendar Callback] User denied access:', error)
      return NextResponse.redirect(new URL('/?view=meet-analysis&calendar=denied', request.url))
    }

    if (!code || !state) {
      console.error('[Calendar Callback] Missing code or state param')
      return NextResponse.redirect(new URL('/?view=meet-analysis&calendar=error&reason=missing_params', request.url))
    }

    // Decode state to get userId and companyId
    let stateData: { userId: string; companyId: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      console.error('[Calendar Callback] Failed to decode state param')
      return NextResponse.redirect(new URL('/?view=meet-analysis&calendar=error&reason=invalid_state', request.url))
    }

    const { userId, companyId } = stateData
    console.log(`[Calendar Callback] Processing for user=${userId}, company=${companyId}`)

    // Exchange code for tokens
    let tokens
    try {
      tokens = await exchangeCodeForTokens(code)
      console.log('[Calendar Callback] Token exchange success, has refresh_token:', !!tokens.refresh_token)
    } catch (tokenError: any) {
      const errMsg = tokenError?.response?.data?.error_description || tokenError?.response?.data?.error || tokenError?.message || 'unknown'
      console.error('[Calendar Callback] Token exchange FAILED:', errMsg)
      console.error('[Calendar Callback] Full token error:', JSON.stringify(tokenError?.response?.data || tokenError?.message))
      const reason = encodeURIComponent(`token_exchange: ${errMsg}`.substring(0, 200))
      return NextResponse.redirect(new URL(`/?view=meet-analysis&calendar=error&reason=${reason}`, request.url))
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[Calendar Callback] Missing tokens - access:', !!tokens.access_token, 'refresh:', !!tokens.refresh_token)
      return NextResponse.redirect(new URL('/?view=meet-analysis&calendar=error&reason=missing_tokens', request.url))
    }

    // Get Google email
    let googleEmail: string
    try {
      googleEmail = await getGoogleEmail(tokens.access_token)
      console.log('[Calendar Callback] Got email:', googleEmail)
    } catch (emailError: any) {
      console.error('[Calendar Callback] getGoogleEmail FAILED:', emailError?.message)
      googleEmail = 'unknown'
    }

    // Calculate token expiry
    const tokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    // Upsert connection (one per user)
    const { error: upsertError } = await supabaseAdmin
      .from('google_calendar_connections')
      .upsert(
        {
          user_id: userId,
          company_id: companyId,
          google_email: googleEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('[Calendar Callback] DB upsert error:', JSON.stringify(upsertError))
      const reason = upsertError.code === '42P01' ? 'table_not_found' : 'db_error'
      return NextResponse.redirect(new URL(`/?view=meet-analysis&calendar=error&reason=${reason}`, request.url))
    }

    console.log(`[Calendar Callback] Connected ${googleEmail} for user ${userId}`)

    // Redirect back to the meet analysis page
    return NextResponse.redirect(new URL('/?view=meet-analysis&calendar=connected', request.url))
  } catch (error: any) {
    console.error('[Calendar Callback] FULL ERROR:', error?.message || error)
    console.error('[Calendar Callback] Stack:', error?.stack)
    const reason = encodeURIComponent(error?.message?.substring(0, 100) || 'unknown')
    return NextResponse.redirect(new URL(`/?view=meet-analysis&calendar=error&reason=${reason}`, request.url))
  }
}
