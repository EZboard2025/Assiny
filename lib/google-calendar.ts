import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/callback'

// Read-write scopes: calendar.events gives full CRUD on events + read calendar metadata
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.send',
]

// Check if connection has write scopes
export function hasWriteScopes(scopes: string[] | null): boolean {
  if (!scopes) return false
  return scopes.includes('https://www.googleapis.com/auth/calendar.events')
}

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
 * Auto-refreshes token if expired. Recovers from 'expired' status automatically.
 * Only returns null if connection doesn't exist or was manually disconnected.
 */
export async function getCalendarClient(userId: string) {
  // Fetch connection — include 'expired' so we can attempt recovery
  const { data: connection, error } = await supabaseAdmin
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'expired'])
    .single()

  if (error || !connection) {
    return null
  }

  if (!connection.refresh_token) {
    console.error('[Google Calendar] No refresh_token stored for user', userId)
    return null
  }

  const oauth2Client = createOAuth2Client()

  // Listen for automatic token refreshes by googleapis and persist to DB
  oauth2Client.on('tokens', async (tokens) => {
    try {
      const updates: Record<string, string> = { updated_at: new Date().toISOString() }
      if (tokens.access_token) updates.access_token = tokens.access_token
      if (tokens.expiry_date) updates.token_expires_at = new Date(tokens.expiry_date).toISOString()
      updates.status = 'active'

      await supabaseAdmin
        .from('google_calendar_connections')
        .update(updates)
        .eq('id', connection.id)

      console.log('[Google Calendar] Auto-refreshed token persisted to DB for user', userId)
    } catch (err) {
      console.warn('[Google Calendar] Failed to persist auto-refreshed token:', err)
    }
  })

  // Check if token is expired (with 5min buffer)
  const expiresAt = new Date(connection.token_expires_at).getTime()
  const now = Date.now()
  const needsRefresh = now > expiresAt - 5 * 60 * 1000 || connection.status === 'expired'

  if (needsRefresh) {
    // Token expired or connection was marked expired — attempt refresh with retry
    let lastError: any = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const newCredentials = await refreshGoogleToken(connection.id, connection.refresh_token)
        oauth2Client.setCredentials({
          access_token: newCredentials.access_token,
          refresh_token: connection.refresh_token,
          expiry_date: newCredentials.expiry_date,
        })
        console.log(`[Google Calendar] Token refreshed on attempt ${attempt} for user ${userId}`)
        lastError = null
        break
      } catch (refreshError) {
        lastError = refreshError
        console.warn(`[Google Calendar] Token refresh attempt ${attempt} failed:`, refreshError)
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000))
      }
    }

    if (lastError) {
      console.error('[Google Calendar] All refresh attempts failed for user', userId)
      // Mark as expired but DON'T return null — let googleapis try with refresh_token
      await supabaseAdmin
        .from('google_calendar_connections')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', connection.id)

      // Still set credentials with refresh_token — googleapis may auto-refresh
      oauth2Client.setCredentials({
        refresh_token: connection.refresh_token,
      })
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
    auth: oauth2Client,
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

/**
 * Send an email via Gmail API using the user's OAuth credentials.
 * Returns true if sent, false if user has no Google connection.
 */
export async function sendGmail(userId: string, options: {
  to: string
  subject: string
  htmlBody: string
}): Promise<boolean> {
  const client = await getCalendarClient(userId)
  if (!client) return false

  const gmail = google.gmail({ version: 'v1', auth: client.auth })

  const message = [
    `To: ${options.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    options.htmlBody,
  ].join('\r\n')

  const encodedMessage = Buffer.from(message).toString('base64url')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  })

  return true
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  meetLink: string
  colorId?: string
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
          colorId: event.colorId || undefined,
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

    // On auth errors, attempt one more refresh before giving up
    if (err.code === 401 || err.code === 403 || err.status === 401 || err.status === 403) {
      console.warn('[Google Calendar] Auth error on fetchUpcomingMeetEvents, will recover on next call')
      // Don't mark as expired — getCalendarClient will handle refresh on next call
    }

    return null
  }
}

/**
 * Fetch ALL upcoming events (not just Meet) from a user's calendar
 */
export async function fetchAllEvents(
  userId: string,
  daysAhead: number = 7
): Promise<CalendarEvent[] | null> {
  const client = await getCalendarClient(userId)
  if (!client) return null

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
      maxResults: 250,
    })

    const events = response.data.items || []

    return events
      .filter(event => event.status !== 'cancelled')
      .map(event => {
        const meetEntry = event.conferenceData?.entryPoints?.find(
          ep => ep.entryPointType === 'video' && ep.uri?.includes('meet.google.com')
        )

        return {
          id: event.id!,
          title: event.summary || 'Sem título',
          start: event.start?.dateTime || event.start?.date || '',
          end: event.end?.dateTime || event.end?.date || null,
          meetLink: meetEntry?.uri || '',
          colorId: event.colorId || undefined,
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
    console.error('[Google Calendar] Failed to fetch all events:', err.message)

    if (err.code === 401 || err.code === 403 || err.status === 401 || err.status === 403) {
      console.warn('[Google Calendar] Auth error on fetchAllEvents, will recover on next call')
    }

    return null
  }
}

/**
 * Create a new event on the user's Google Calendar
 */
export interface CreateEventInput {
  title: string
  description?: string
  startDateTime: string
  endDateTime: string
  attendees?: string[]
  addMeetLink: boolean
  timeZone?: string
}

export async function createCalendarEvent(
  userId: string,
  input: CreateEventInput
): Promise<CalendarEvent | null> {
  const client = await getCalendarClient(userId)
  if (!client) return null

  try {
    const eventBody: any = {
      summary: input.title,
      description: input.description || '',
      start: { dateTime: input.startDateTime, timeZone: input.timeZone || 'America/Sao_Paulo' },
      end: { dateTime: input.endDateTime, timeZone: input.timeZone || 'America/Sao_Paulo' },
    }

    if (input.attendees?.length) {
      eventBody.attendees = input.attendees.map(email => ({ email }))
    }

    console.log('[Google Calendar] Creating event with body:', JSON.stringify(eventBody, null, 2))

    if (input.addMeetLink) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `ramppy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    const response = await client.calendar.events.insert({
      calendarId: client.connection.calendar_id || 'primary',
      requestBody: eventBody,
      conferenceDataVersion: input.addMeetLink ? 1 : 0,
      sendUpdates: 'all',
    })

    const created = response.data
    console.log('[Google Calendar] Created event, attendees from Google:', JSON.stringify(created.attendees || []))

    const meetEntry = created.conferenceData?.entryPoints?.find(
      ep => ep.entryPointType === 'video' && ep.uri?.includes('meet.google.com')
    )

    return {
      id: created.id!,
      title: created.summary || input.title,
      start: created.start?.dateTime || created.start?.date || input.startDateTime,
      end: created.end?.dateTime || created.end?.date || null,
      meetLink: meetEntry?.uri || '',
      colorId: created.colorId || undefined,
      attendees: (created.attendees || []).map(a => ({
        email: a.email || '',
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
      })),
      organizer: created.organizer ? {
        email: created.organizer.email || '',
        displayName: created.organizer.displayName || undefined,
      } : null,
      description: created.description || null,
    }
  } catch (err: any) {
    console.error('[Google Calendar] Failed to create event:', err.message)
    return null
  }
}

/**
 * Delete an event from the user's Google Calendar
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const client = await getCalendarClient(userId)
  if (!client) return false

  try {
    await client.calendar.events.delete({
      calendarId: client.connection.calendar_id || 'primary',
      eventId,
      sendUpdates: 'all',
    })
    return true
  } catch (err: any) {
    console.error('[Google Calendar] Failed to delete event:', err.message)
    return false
  }
}

/**
 * Add attendees to an existing event (PATCH)
 */
export async function updateEventAttendees(
  userId: string,
  eventId: string,
  attendees: string[]
): Promise<{ attendees: Array<{ email: string; displayName?: string; responseStatus?: string }> } | null> {
  const client = await getCalendarClient(userId)
  if (!client) return null

  try {
    // First fetch the existing event to preserve current attendees
    const existing = await client.calendar.events.get({
      calendarId: client.connection.calendar_id || 'primary',
      eventId,
    })

    const currentAttendees = existing.data.attendees || []
    const currentEmails = new Set(currentAttendees.map(a => a.email?.toLowerCase()))

    // Merge: keep existing + add new
    const merged = [
      ...currentAttendees,
      ...attendees
        .filter(email => !currentEmails.has(email.toLowerCase()))
        .map(email => ({ email })),
    ]

    const response = await client.calendar.events.patch({
      calendarId: client.connection.calendar_id || 'primary',
      eventId,
      sendUpdates: 'all',
      requestBody: {
        attendees: merged,
      },
    })

    return {
      attendees: (response.data.attendees || []).map(a => ({
        email: a.email || '',
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || 'needsAction',
      })),
    }
  } catch (err: any) {
    console.error('[Google Calendar] Failed to update attendees:', err.message)
    return null
  }
}

/**
 * Update an existing calendar event (title, time, description, attendees, Meet link)
 */
export interface UpdateEventData {
  title?: string
  startDateTime?: string
  endDateTime?: string
  description?: string
  attendees?: string[]
  addMeetLink?: boolean
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  data: UpdateEventData
): Promise<CalendarEvent | null> {
  const client = await getCalendarClient(userId)
  if (!client) return null

  try {
    const requestBody: any = {}

    if (data.title !== undefined) {
      requestBody.summary = data.title
    }

    if (data.startDateTime) {
      requestBody.start = {
        dateTime: data.startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    }

    if (data.endDateTime) {
      requestBody.end = {
        dateTime: data.endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    }

    if (data.description !== undefined) {
      requestBody.description = data.description
    }

    if (data.attendees !== undefined) {
      requestBody.attendees = data.attendees.map(email => ({ email }))
    }

    // Add or keep Meet link
    if (data.addMeetLink) {
      // First check if event already has conference data
      const existing = await client.calendar.events.get({
        calendarId: client.connection.calendar_id || 'primary',
        eventId,
      })

      if (!existing.data.conferenceData) {
        requestBody.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        }
      }
    }

    const response = await client.calendar.events.patch({
      calendarId: client.connection.calendar_id || 'primary',
      eventId,
      sendUpdates: 'all',
      conferenceDataVersion: 1,
      requestBody,
    })

    const event = response.data
    const meetEntry = event.conferenceData?.entryPoints?.find(
      (e: any) => e.entryPointType === 'video'
    )

    return {
      id: event.id!,
      title: event.summary || 'Sem título',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || null,
      meetLink: meetEntry?.uri || '',
      colorId: event.colorId || undefined,
      attendees: (event.attendees || []).map(a => ({
        email: a.email || '',
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || 'needsAction',
      })),
      organizer: event.organizer ? {
        email: event.organizer.email || '',
        displayName: event.organizer.displayName || undefined,
      } : null,
      description: event.description || null,
    }
  } catch (err: any) {
    console.error('[Google Calendar] Failed to update event:', err.message)
    return null
  }
}

/**
 * QuickAdd: create event from natural language text
 */
export async function quickAddEvent(
  userId: string,
  text: string
): Promise<CalendarEvent | null> {
  const client = await getCalendarClient(userId)
  if (!client) return null

  try {
    const response = await client.calendar.events.quickAdd({
      calendarId: client.connection.calendar_id || 'primary',
      text,
    })

    const event = response.data
    const meetEntry = event.conferenceData?.entryPoints?.find(
      ep => ep.entryPointType === 'video' && ep.uri?.includes('meet.google.com')
    )

    return {
      id: event.id!,
      title: event.summary || text,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || null,
      meetLink: meetEntry?.uri || '',
      colorId: event.colorId || undefined,
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
  } catch (err: any) {
    console.error('[Google Calendar] QuickAdd failed:', err.message)
    return null
  }
}

/**
 * Check free/busy availability for a set of emails
 */
export interface FreeBusyResult {
  email: string
  busy: Array<{ start: string; end: string }>
}

export async function checkFreeBusy(
  userId: string,
  timeMin: string,
  timeMax: string,
  emails: string[]
): Promise<FreeBusyResult[] | null> {
  const client = await getCalendarClient(userId)
  if (!client) return null

  try {
    const response = await client.calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'America/Sao_Paulo',
        items: emails.map(email => ({ id: email })),
      },
    })

    const calendars = response.data.calendars || {}
    return Object.entries(calendars).map(([email, data]) => ({
      email,
      busy: ((data as any).busy || []).map((slot: any) => ({
        start: slot.start || '',
        end: slot.end || '',
      })),
    }))
  } catch (err: any) {
    console.error('[Google Calendar] FreeBusy failed:', err.message)
    return null
  }
}
