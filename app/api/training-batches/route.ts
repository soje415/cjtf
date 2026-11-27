import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/print-batches-server'
import { sectorCommandKey, sectorCommandName } from '@/lib/sectors'
import { sendSms } from '@/lib/termii'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 200

// POST: Admin confirms training for several applicants of ONE sector command,
// which puts them in the print queue. Body: { applicationIds }
export async function POST(req: NextRequest) {
  const staff = await getStaffSession()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (staff.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { service, userId } = staff

  const body = await req.json().catch(() => null)
  const ids: string[] = Array.isArray(body?.applicationIds) ? [...new Set<string>(body.applicationIds)] : []

  if (ids.length === 0) return NextResponse.json({ error: 'Select at least one applicant.' }, { status: 400 })
  if (ids.length > MAX_BATCH) {
    return NextResponse.json({ error: `You can confirm at most ${MAX_BATCH} applicants at a time.` }, { status: 400 })
  }
  if (!ids.every((i) => typeof i === 'string' && UUID_RE.test(i))) {
    return NextResponse.json({ error: 'Invalid application id' }, { status: 400 })
  }

  const { data: apps, error: readErr } = await service
    .from('applications').select('id, sector_command').in('id', ids)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!apps || apps.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected applicants no longer exist.' }, { status: 400 })
  }
  if (new Set(apps.map((a) => sectorCommandKey(a.sector_command))).size !== 1) {
    return NextResponse.json({ error: 'All applicants confirmed together must belong to the same Sector Command.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  // Conditional on the prior status, so a double submit can't fire twice.
  const { data, error } = await service
    .from('applications')
    .update({ status: 'APPROVED_GENERATING_ID', trained_at: now, updated_at: now })
    .in('id', ids)
    .eq('status', 'PENDING_TRAINING')
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const moved = (data ?? []).map((r) => r.id as string)
  if (moved.length === 0) {
    return NextResponse.json({ error: 'These applicants have already been confirmed. Refresh the page.' }, { status: 409 })
  }

  const { error: noteErr } = await service.from('application_notes').insert(
    moved.map((id) => ({
      application_id: id,
      staff_id: userId,
      action: 'training_completed',
      note: `Training completed (confirmed in a batch of ${moved.length})`,
    }))
  )

  // One summary text to ICT, not one per applicant.
  try {
    const { data: officers } = await service.from('profiles').select('phone').eq('role', 'ict')
    const phones = (officers ?? []).map((p) => p.phone).filter(Boolean) as string[]
    if (phones.length) {
      await sendSms(phones, `CJTF Portal: ${moved.length} applicant(s) from ${sectorCommandName(apps[0].sector_command) || 'no sector'} have completed training and are ready for ID generation.`)
    }
  } catch { /* never fail the batch over an SMS */ }

  return NextResponse.json({
    ok: true,
    confirmed: moved.length,
    skipped: ids.length - moved.length,
    warning: noteErr ? `The training notes were not saved (${noteErr.message}).` : null,
  })
}
