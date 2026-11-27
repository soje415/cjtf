import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/print-batches-server'
import { sectorCommandKey, sectorCommandName } from '@/lib/sectors'
import { isValidRank } from '@/lib/ranks'
import { sendSms } from '@/lib/termii'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 200

// POST: INT clears several applicants of ONE sector command and sends them to
// Admin together. Body: { note, items: [{ id, rank }] }
// Everyone in a batch gets the same int_cleared_at, which is how Admin's
// dashboard groups them.
export async function POST(req: NextRequest) {
  const staff = await getStaffSession()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (staff.role !== 'int') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { service, userId } = staff

  const body = await req.json().catch(() => null)
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : ''
  const items: { id: string; rank: string }[] = Array.isArray(body?.items) ? body.items : []

  if (items.length === 0) return NextResponse.json({ error: 'Select at least one applicant.' }, { status: 400 })
  if (items.length > MAX_BATCH) {
    return NextResponse.json({ error: `A batch can hold at most ${MAX_BATCH} applicants. Send the sector in parts.` }, { status: 400 })
  }
  if (!note) return NextResponse.json({ error: 'Screening note required' }, { status: 400 })
  if (!items.every((i) => typeof i?.id === 'string' && UUID_RE.test(i.id))) {
    return NextResponse.json({ error: 'Invalid application id' }, { status: 400 })
  }
  if (!items.every((i) => isValidRank(i.rank))) {
    return NextResponse.json({ error: 'Every applicant needs a recommended rank' }, { status: 400 })
  }
  const ids = items.map((i) => i.id)
  if (new Set(ids).size !== ids.length) return NextResponse.json({ error: 'An applicant is listed twice.' }, { status: 400 })

  const { data: apps, error: readErr } = await service
    .from('applications').select('id, status, sector_command').in('id', ids)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!apps || apps.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected applicants no longer exist.' }, { status: 400 })
  }
  const sectorKeys = new Set(apps.map((a) => sectorCommandKey(a.sector_command)))
  if (sectorKeys.size !== 1 || sectorKeys.has('')) {
    return NextResponse.json({ error: 'All applicants in a batch must belong to the same Sector Command.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const idsByRank = new Map<string, string[]>()
  for (const i of items) idsByRank.set(i.rank, [...(idsByRank.get(i.rank) ?? []), i.id])

  // Conditional on the prior status, so nobody already moved is moved again.
  const moved: { id: string; rank: string }[] = []
  let failure: string | null = null
  for (const [rank, rankIds] of Array.from(idsByRank.entries())) {
    const { data, error } = await service
      .from('applications')
      .update({ status: 'PENDING_ADMIN_APPROVAL', recommended_rank: rank, int_cleared_at: now, updated_at: now })
      .in('id', rankIds)
      .eq('status', 'PENDING_INT_SCREENING')
      .select('id')
    if (error) { failure = error.message; break }
    for (const row of data ?? []) moved.push({ id: row.id as string, rank })
  }

  if (moved.length === 0) {
    return NextResponse.json(
      { error: failure ?? 'These applicants have already been sent. Refresh the page.' },
      { status: failure ? 500 : 409 }
    )
  }

  const { error: noteErr } = await service.from('application_notes').insert(
    moved.flatMap((m) => [
      { application_id: m.id, staff_id: userId, action: 'int_cleared', note: `${note} (sent to Admin in a batch of ${moved.length})` },
      { application_id: m.id, staff_id: userId, action: 'rank_recommended', note: `Recommended rank: ${m.rank}` },
    ])
  )

  // One summary text to Admin, not one per applicant.
  try {
    const { data: admins } = await service.from('profiles').select('phone').eq('role', 'admin')
    const phones = (admins ?? []).map((p) => p.phone).filter(Boolean) as string[]
    if (phones.length) {
      await sendSms(phones, `CJTF Portal: ${moved.length} application(s) from ${sectorCommandName(apps[0].sector_command)} cleared Intelligence screening and require your approval.`)
    }
  } catch { /* never fail the batch over an SMS */ }

  const problems: string[] = []
  if (failure) problems.push(`${ids.length - moved.length} could not be sent (${failure}).`)
  if (noteErr) problems.push(`The screening notes were not saved (${noteErr.message}).`)

  return NextResponse.json({
    ok: true,
    sent: moved.length,
    skipped: ids.length - moved.length,
    warning: problems.join(' ') || null,
  })
}
