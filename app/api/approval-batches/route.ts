import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/print-batches-server'
import { sectorCommandKey } from '@/lib/sectors'
import { isValidRank } from '@/lib/ranks'
import { sendSms } from '@/lib/termii'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 200
const SMS_AT_ONCE = 10

export const maxDuration = 60

// POST: Admin approves several applicants of ONE sector command and sends them
// to training together. Body: { note, items: [{ id, rank }] }
export async function POST(req: NextRequest) {
  const staff = await getStaffSession()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (staff.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { service, userId } = staff

  const body = await req.json().catch(() => null)
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : ''
  const items: { id: string; rank: string }[] = Array.isArray(body?.items) ? body.items : []

  if (items.length === 0) return NextResponse.json({ error: 'Select at least one applicant.' }, { status: 400 })
  if (items.length > MAX_BATCH) {
    return NextResponse.json({ error: `You can approve at most ${MAX_BATCH} applicants at a time.` }, { status: 400 })
  }
  if (!note) return NextResponse.json({ error: 'Decision note required' }, { status: 400 })
  if (!items.every((i) => typeof i?.id === 'string' && UUID_RE.test(i.id))) {
    return NextResponse.json({ error: 'Invalid application id' }, { status: 400 })
  }
  if (!items.every((i) => isValidRank(i.rank))) {
    return NextResponse.json({ error: 'Every applicant needs a rank' }, { status: 400 })
  }
  const ids = items.map((i) => i.id)
  if (new Set(ids).size !== ids.length) return NextResponse.json({ error: 'An applicant is listed twice.' }, { status: 400 })

  const { data: apps, error: readErr } = await service
    .from('applications').select('id, sector_command, first_name, last_name, phone_number').in('id', ids)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!apps || apps.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected applicants no longer exist.' }, { status: 400 })
  }
  // Legacy records may have no sector at all; they can only go through together.
  if (new Set(apps.map((a) => sectorCommandKey(a.sector_command))).size !== 1) {
    return NextResponse.json({ error: 'All applicants approved together must belong to the same Sector Command.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const idsByRank = new Map<string, string[]>()
  for (const i of items) idsByRank.set(i.rank, [...(idsByRank.get(i.rank) ?? []), i.id])

  // Conditional on the prior status, so nobody already decided is moved again.
  const moved: { id: string; rank: string }[] = []
  let failure: string | null = null
  for (const [rank, rankIds] of Array.from(idsByRank.entries())) {
    const { data, error } = await service
      .from('applications')
      .update({
        status: 'PENDING_TRAINING',
        cjtf_rank: rank,
        rank_assigned_by: userId,
        rank_assigned_at: now,
        admin_approved_at: now,
        updated_at: now,
      })
      .in('id', rankIds)
      .eq('status', 'PENDING_ADMIN_APPROVAL')
      .select('id')
    if (error) { failure = error.message; break }
    for (const row of data ?? []) moved.push({ id: row.id as string, rank })
  }

  if (moved.length === 0) {
    return NextResponse.json(
      { error: failure ?? 'These applicants have already been decided. Refresh the page.' },
      { status: failure ? 500 : 409 }
    )
  }

  const { error: noteErr } = await service.from('application_notes').insert(
    moved.flatMap((m) => [
      { application_id: m.id, staff_id: userId, action: 'admin_approved', note: `${note} (approved in a batch of ${moved.length})` },
      { application_id: m.id, staff_id: userId, action: 'rank_assigned', note: `Rank assigned: ${m.rank}` },
    ])
  )

  // Same text each applicant gets from a single approval. Best effort.
  const byId = new Map(apps.map((a) => [a.id as string, a]))
  for (let i = 0; i < moved.length; i += SMS_AT_ONCE) {
    await Promise.allSettled(
      moved.slice(i, i + SMS_AT_ONCE).map(async (m) => {
        const a = byId.get(m.id)
        if (!a?.phone_number) return
        await sendSms(
          a.phone_number,
          `CJTF Portal: Congratulations ${a.first_name} ${a.last_name}, you have been cleared by Command and assigned the rank of ${m.rank}. You are now scheduled for training and will be notified of the next steps.`
        )
      })
    )
  }

  const problems: string[] = []
  if (failure) problems.push(`${ids.length - moved.length} could not be approved (${failure}).`)
  if (noteErr) problems.push(`The decision notes were not saved (${noteErr.message}).`)

  return NextResponse.json({
    ok: true,
    approved: moved.length,
    skipped: ids.length - moved.length,
    warning: problems.join(' ') || null,
  })
}
