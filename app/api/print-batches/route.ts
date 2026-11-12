import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession, logPrintEvent } from '@/lib/print-batches-server'
import { canSendBatches } from '@/lib/print-batches'
import { makeGroupKey, normalizeSectorName } from '@/lib/sectors'
import { sendSms } from '@/lib/termii'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CARDS_PER_BATCH = 200

// POST: INT / Admin send a sector + sub-sector group of completed ID cards to
// ICT for printing. Body: { groupKey, applicationIds: string[], note?: string }
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
    return NextResponse.json({ error: 'Select at least one card to send.' }, { status: 400 })
  }
  if (ids.length > MAX_CARDS_PER_BATCH) {
    return NextResponse.json({ error: `A batch can hold at most ${MAX_CARDS_PER_BATCH} cards. Send the group in parts.` }, { status: 400 })
  }
  if (!ids.every((i) => UUID_RE.test(i))) {
    return NextResponse.json({ error: 'Invalid application id' }, { status: 400 })
  }

  const { data: apps, error: readErr } = await service
    .from('applications')
    .select('id, status, print_status, id_card_pdf_url, sector_command, sub_sector')
    .in('id', ids)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!apps || apps.length !== ids.length) {
    return NextResponse.json({ error: 'Some selected cards no longer exist.' }, { status: 400 })
  }

  const [scKey, ssKey] = groupKey.split('|')
  if (!scKey || !ssKey) {
    return NextResponse.json({ error: 'This group has no Sector Command / Sub Sector. Fix the applicants’ records first.' }, { status: 400 })
  }
  for (const a of apps) {
    if (a.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Only cards with a completed ID can be sent for printing.' }, { status: 400 })
    }
    if (a.print_status !== 'not_queued') {
      return NextResponse.json({ error: 'One or more selected cards were already sent for printing. Refresh and try again.' }, { status: 409 })
    }
    if (!a.id_card_pdf_url) {
      return NextResponse.json({ error: 'One or more selected cards have no generated card file yet.' }, { status: 400 })
    }
    if (makeGroupKey(a.sector_command, a.sub_sector) !== groupKey) {
      return NextResponse.json({ error: 'All cards in a batch must belong to the same sector and sub-sector.' }, { status: 400 })
    }
  }

  // Display spelling: the most common normalised form among the selection.
  const pick = (vals: (string | null)[]) => {
    const counts = new Map<string, number>()
    for (const v of vals) { const n = normalizeSectorName(v); if (n) counts.set(n, (counts.get(n) ?? 0) + 1) }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  }
  const sectorCommand = pick(apps.map((a) => a.sector_command))
  const subSector = pick(apps.map((a) => a.sub_sector))

  const { data: batch, error: batchErr } = await service
    .from('print_batches')
    .insert({
      sector_command: sectorCommand,
      sub_sector: subSector,
      group_key: groupKey,
      card_count: ids.length,
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
    return NextResponse.json({ error: 'Some cards were just sent by someone else. Refresh and try again.' }, { status: 409 })
  }

  const { error: itemsErr } = await service
    .from('print_batch_items')
    .insert(ids.map((application_id) => ({ batch_id: batch.id, application_id })))
  if (itemsErr) {
    await rollback()
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  await logPrintEvent(service, batch.id, staff.userId, staff.role, 'sent', note)

  // Alert ICT (best effort — never fail the request over an SMS).
  try {
    const { data: ict } = await service.from('profiles').select('phone').eq('role', 'ict')
    const phones = (ict ?? []).map((p) => p.phone).filter(Boolean) as string[]
    if (phones.length) {
      await sendSms(
        phones,
        `CJTF Portal: ${ids.length} ID card(s) for ${sectorCommand} / ${subSector} (${batch.batch_no}) are ready for printing.`
      )
    }
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true, batch })
}
