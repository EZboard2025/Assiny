import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Backfill ML patterns from existing meet_evaluations.
 * Processes evaluations that don't have patterns extracted yet.
 * POST /api/meet/backfill-patterns
 * Body: { companyId?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, limit = 50 } = await request.json().catch(() => ({}))

    // Find evaluations that haven't been processed yet
    // (no matching records in meeting_patterns)
    let query = supabaseAdmin
      .from('meet_evaluations')
      .select('id, company_id, transcript, evaluation')
      .not('transcript', 'is', null)
      .not('evaluation', 'is', null)
      .neq('meeting_category', 'non_sales')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data: evaluations, error } = await query

    if (error) {
      console.error('[Backfill] Error fetching evaluations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ success: true, message: 'No evaluations to process', processed: 0 })
    }

    // Check which ones already have patterns
    const evalIds = evaluations.map(e => e.id)
    const { data: existingPatterns } = await supabaseAdmin
      .from('meeting_patterns')
      .select('meet_evaluation_id')
      .in('meet_evaluation_id', evalIds)

    const alreadyProcessed = new Set((existingPatterns || []).map(p => p.meet_evaluation_id))
    const toProcess = evaluations.filter(e => !alreadyProcessed.has(e.id))

    console.log(`[Backfill] Found ${evaluations.length} evaluations, ${toProcess.length} need processing`)

    if (toProcess.length === 0) {
      return NextResponse.json({ success: true, message: 'All evaluations already processed', processed: 0 })
    }

    // Process each evaluation sequentially (to avoid rate limits)
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const appUrl = `${protocol}://${host}`
    let processed = 0
    let failed = 0
    const results: { id: string; status: string }[] = []

    for (const eval_ of toProcess) {
      try {
        console.log(`[Backfill] Processing ${eval_.id} (company: ${eval_.company_id})`)

        const response = await fetch(`${appUrl}/api/meet/extract-patterns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetEvaluationId: eval_.id,
            transcript: eval_.transcript,
            evaluation: eval_.evaluation,
            companyId: eval_.company_id,
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.skipped) {
            results.push({ id: eval_.id, status: 'skipped' })
          } else {
            processed++
            results.push({ id: eval_.id, status: 'ok' })
          }
        } else {
          failed++
          results.push({ id: eval_.id, status: `error_${response.status}` })
        }

        // Small delay between calls to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (err: any) {
        failed++
        results.push({ id: eval_.id, status: `error: ${err.message}` })
      }
    }

    console.log(`[Backfill] Done: ${processed} processed, ${failed} failed`)

    return NextResponse.json({
      success: true,
      total: evaluations.length,
      already_processed: alreadyProcessed.size,
      processed,
      failed,
      results,
    })
  } catch (error: any) {
    console.error('[Backfill] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
