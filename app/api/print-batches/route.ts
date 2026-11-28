import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession, logPrintEvent } from '@/lib/print-batches-server'
import { canSendBatches, BATCHABLE_STATUSES } from '@/lib/print-batches'
import { makeGroupKey, sectorCommandName, subSectorName } from '@/lib/sectors'
import { sendSms } from '@/lib/termii'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CARDS_PER_BATCH = 200

// POST: build a batch of approved applicants from one sector + sub-sector group.
//   INT   → batch starts 'with_admin' (Admin reviews and forwards it to ICT)
//   Admin → batch starts 'with_ict'   (Admin is the forwarding authority)
// ICT then generates each person's card. Body: { groupKey, applicationIds, note? }
export async function POST(req: NextRequest) {
  const staff = await getStaffSession()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendBatches(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { service } = staff

  const body = await req.json().catch(() => null)
  const groupKey: string = typeof body?.groupKey === 'string' ? body.groupKey : ''
  const note: string | null = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null
  const ids: string[] = Array.isArray(body?.applicationIds) ? [...new Set<string>(body.applicationIds)] : []

  if (!groupKey || ids.length === 0) {
    return NextResponse.json({ error: 'Select at least one applicant to send.' }, { status: 400 })
  }
  if (ids.length > MAX_CARDS_PER_BATCH) {
    return NextResponse.json({ error: `A batch can hold at most ${MAX_CARDS_PER_BATCH} applicants. Send the group in parts.` }, { status: 400 })
  }
  if (!ids.every((i) => UUID_RE.test(i))) {
    return NextResponse.json({ error: 'Invalid application id' }, { status: 400 })
  }

  const { data: apps, error: readErr } = await service
    .from('applications')
    .select('id, status, print_status, sector_command, sub_sector')
    .in('id', ids)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!apps || apps.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected applicants no longer exist.' }, { status: 400 })
  }

  const [scKey, ssKey] = groupKey.split('|')
  if (!scKey || !ssKey) {
    return NextResponse.json({ error: 'This group has no Sector Command / Sub Sector. Fix the applicants’ records first.' }, { status: 400 })
  }
  for (const a of apps) {
    if (!(BATCHABLE_STATUSES as readonly string[]).includes(a.status)) {
      return NextResponse.json({ error: 'Only approved applicants can be put in a batch.' }, { status: 400 })
    }
    if (a.print_status !== 'not_queued') {
      return NextResponse.json({ error: 'One or more selected applicants are already in a batch. Refresh and try again.' }, { status: 409 })
    }
    if (makeGroupKey(a.sector_command, a.sub_sector) !== groupKey) {
      return NextResponse.json({ error: 'All applicants in a batch must belong to the same sector and sub-sector.' }, { status: 400 })
    }
  }

  // Display spelling: the most common normalised form among the selection.
  const pick = (vals: (string | null)[], tidy: (v: string | null) => string) => {
    const counts = new Map<string, number>()
    for (const v of vals) { const n = tidy(v); if (n) counts.set(n, (counts.get(n) ?? 0) + 1) }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  }
  const sectorCommand = pick(apps.map((a) => a.sector_command), sectorCommandName)
  const subSector = subSectorName(apps[0].sector_command, apps[0].sub_sector)

  const { data: batch, error: batchErr } = await service
    .from('print_batches')
    .insert({
      sector_command: sectorCommand,
      sub_sector: subSector,
      group_key: groupKey,
      card_count: ids.length,
      status: staff.role === 'admin' ? 'with_ict' : 'with_admin',
      requested_by: staff.userId,
      requested_role: staff.role,
      note,
    })
    .select('*')
    .single()
  if (batchErr || !batch) return NextResponse.json({ error: batchErr?.message ?? 'Could not create batch' }, { status: 500 })

  const rollback = async () => {
    await service.from('applications').update({ print_status: 'not_queued' }).in('id', ids).eq('print_status', 'queued')
    await service.from('print_batches').delete().eq('id', batch.id) // items + events cascade
  }

  // Conditional update is the double-send guard: only cards still 'not_queued'
  // flip to 'queued'. If a concurrent request won any of them, undo everything.
  const { data: claimed, error: claimErr } = await service
    .from('applications')
    .update({ print_status: 'queued', updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('print_status', 'not_queued')
    .select('id')
  if (claimErr || (claimed?.length ?? 0) !== ids.length) {
    // Only release rows we actually claimed.
    const claimedIds = (claimed ?? []).map((r) => r.id)
    if (claimedIds.length) await service.from('applications').update({ print_status: 'not_queued' }).in('id', claimedIds)
    await service.from('print_batches').delete().eq('id', batch.id)
    return NextResponse.json({ error: 'Some applicants were just batched by someone else. Refresh and try again.' }, { status: 409 })
  }

  const { error: itemsErr } = await service
    .from('print_batch_items')
    .insert(ids.map((application_id) => ({ batch_id: batch.id, application_id })))
  if (itemsErr) {
    await rollback()
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  await logPrintEvent(service, batch.id, staff.userId, staff.role, 'sent', note)

  // Alert whoever holds the batch next (best effort — never fail over an SMS).
  try {
    const nextRole = staff.role === 'admin' ? 'ict' : 'admin'
    const { data: next } = await service.from('profiles').select('phone').eq('role', nextRole)
    const phones = (next ?? []).map((p) => p.phone).filter(Boolean) as string[]
    if (phones.length) {
      await sendSms(
        phones,
        nextRole === 'admin'
          ? `CJTF Portal: INT sent batch ${batch.batch_no} (${ids.length} applicant(s), ${sectorCommand} / ${subSector}) for your review.`
          : `CJTF Portal: batch ${batch.batch_no} (${ids.length} applicant(s), ${sectorCommand} / ${subSector}) is ready for ID generation.`
      )
    }
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true, batch })
}
