import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/callback'

// Scopes for read-only calendar access + email for identification
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

/**
 * Create a base OAuth2 client (without user tokens)
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  )
}

/**
 * Generate the Google OAuth consent URL
 */
export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Needed for refresh_token
    prompt: 'consent',      // Force consent to always get refresh_token
    scope: GOOGLE_SCOPES,
    state,
  })
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

/**
 * Get the Google email associated with an access token.
 * Tries oauth2 userinfo first, falls back to tokeninfo endpoint.
 */
export async function getGoogleEmail(accessToken: string): Promise<string> {
  // Method 1: Try oauth2 userinfo API
  try {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data } = await oauth2.userinfo.get()
    if (data.email) return data.email
  } catch (err: any) {
    console.warn('[Google Calendar] oauth2.userinfo failed, trying tokeninfo fallback:', err.message)
  }

  // Method 2: Fallback to tokeninfo endpoint
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`)
    if (res.ok) {
      const data = await res.json()
      if (data.email) return data.email
    }
  } catch (err: any) {
    console.warn('[Google Calendar] tokeninfo fallback also failed:', err.message)
  }

  return 'unknown'
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshGoogleToken(connectionId: string, refreshToken: string) {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()

  // Update tokens in database
  await supabaseAdmin
    .from('google_calendar_connections')
    .update({
      access_token: credentials.access_token,
      token_expires_at: new Date(credentials.expiry_date || Date.now() + 3600000).toISOString(),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)

  return credentials
}

/**
 * Get an authenticated Google Calendar client for a user.
 * Auto-refreshes token if expired.
 */
export async function getCalendarClient(userId: string) {
  // Fetch connection from DB
  const { data: connection, error } = await supabaseAdmin
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error || !connection) {
    return null
  }

  const oauth2Client = createOAuth2Client()

  // Check if token is expired (with 5min buffer)
  const expiresAt = new Date(connection.token_expires_at).getTime()
  const now = Date.now()

  if (now > expiresAt - 5 * 60 * 1000) {
    // Token expired or about to expire — refresh
    try {
      const newCredentials = await refreshGoogleToken(connection.id, connection.refresh_token)
      oauth2Client.setCredentials({
        access_token: newCredentials.access_token,
        refresh_token: connection.refresh_token,
        expiry_date: newCredentials.expiry_date,
      })
    } catch (refreshError) {
      console.error('[Google Calendar] Token refresh failed:', refreshError)
      // Mark connection as expired
      await supabaseAdmin
        .from('google_calendar_connections')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', connection.id)
      return null
    }
  } else {
    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: expiresAt,
    })
  }

  return {
    calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
    connection,
  }
}

/**
 * Revoke a Google token
 */
export async function revokeGoogleToken(accessToken: string) {
  const oauth2Client = createOAuth2Client()
  try {
    await oauth2Client.revokeToken(accessToken)
  } catch (err) {
    // Token might already be revoked — that's fine
    console.warn('[Google Calendar] Token revocation warning:', err)
  }
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  meetLink: string
  attendees: Array<{ email: string; displayName?: string; responseStatus?: string }>
  organizer: { email: string; displayName?: string } | null
  description: string | null
}

/**
 * Fetch upcoming events with Google Meet links from a user's calendar
 */
export async function fetchUpcomingMeetEvents(
  userId: string,
  daysAhead: number = 7
): Promise<CalendarEvent[] | null> {
  const client = await getCalendarClient(userId)
  if (!client) return null

  // Start from beginning of today (not "now") to include meetings that already started
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const future = new Date(startOfToday.getTime() + (daysAhead + 1) * 24 * 60 * 60 * 1000)

  try {
    const response = await client.calendar.events.list({
      calendarId: client.connection.calendar_id || 'primary',
      timeMin: startOfToday.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    })

    const events = response.data.items || []

    // Filter to only events with Google Meet links
    return events
      .filter(event => {
        const entryPoints = event.conferenceData?.entryPoints || []
        return entryPoints.some(ep => ep.entryPointType === 'video' && ep.uri?.includes('meet.google.com'))
      })
      .map(event => {
        const meetEntry = event.conferenceData!.entryPoints!.find(
          ep => ep.entryPointType === 'video' && ep.uri?.includes('meet.google.com')
        )

        return {
          id: event.id!,
          title: event.summary || 'Sem título',
          start: event.start?.dateTime || event.start?.date || '',
          end: event.end?.dateTime || event.end?.date || null,
          meetLink: meetEntry!.uri!,
          attendees: (event.attendees || []).map(a => ({
            email: a.email || '',
            displayName: a.displayName || undefined,
            responseStatus: a.responseStatus || undefined,
          })),
          organizer: event.organizer ? {
            email: event.organizer.email || '',
            displayName: event.organizer.displayName || undefined,
          } : null,
          description: event.description || null,
        }
      })
  } catch (err: any) {
    console.error('[Google Calendar] Failed to fetch events:', err.message)

    // If 401/403, mark as expired
    if (err.code === 401 || err.code === 403) {
      await supabaseAdmin
        .from('google_calendar_connections')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', client.connection.id)
    }

    return null
  }
}
