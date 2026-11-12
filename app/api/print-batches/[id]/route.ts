import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession, logPrintEvent } from '@/lib/print-batches-server'
import { canSendBatches, canViewBatches } from '@/lib/print-batches'
import { sendSms } from '@/lib/termii'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH: advance a print batch. Body: { action, note? }
//   downloaded — ICT opened/downloaded the print file (audit only)
//   printed    — ICT finished printing            (sent → printed)
//   collected  — cards handed over                 (printed → collected)
//   cancel     — INT/Admin pull a batch back       (sent → cancelled)
//   reprint    — send a printed batch back to ICT  (printed|collected → sent), note required
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 })

  const staff = await getStaffSession()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewBatches(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { service, userId, role } = staff

  const body = await req.json().catch(() => null)
  const action: string = body?.action ?? ''
  const note: string | null = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null
  const now = new Date().toISOString()

  const { data: batch } = await service.from('print_batches').select('*').eq('id', params.id).maybeSingle()
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const { data: items } = await service.from('print_batch_items').select('application_id').eq('batch_id', batch.id)
  const appIds = (items ?? []).map((i) => i.application_id as string)

  const notifyRequester = async (message: string) => {
    try {
      if (!batch.requested_by) return
      const { data: p } = await service.from('profiles').select('phone').eq('id', batch.requested_by).maybeSingle()
      if (p?.phone) await sendSms(p.phone, message)
    } catch { /* ignore */ }
  }

  switch (action) {
    case 'downloaded': {
      if (role !== 'ict') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await logPrintEvent(service, batch.id, userId, role, 'downloaded', note)
      return NextResponse.json({ ok: true })
    }

    case 'printed': {
      if (role !== 'ict') return NextResponse.json({ error: 'Only ICT can mark a batch printed.' }, { status: 403 })
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'printed', printed_by: userId, printed_at: now, updated_at: now })
        .eq('id', batch.id).eq('status', 'sent')
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'This batch is not awaiting printing.' }, { status: 409 })
      if (appIds.length) {
        await service.from('applications').update({ print_status: 'printed', updated_at: now }).in('id', appIds).eq('print_status', 'queued')
      }
      await logPrintEvent(service, batch.id, userId, role, 'printed', note)
      await notifyRequester(`CJTF Portal: ${batch.card_count} ID card(s) for ${batch.sector_command} / ${batch.sub_sector} (${batch.batch_no}) have been printed by ICT.`)
      return NextResponse.json({ ok: true })
    }

    case 'collected': {
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'collected', collected_by: userId, collected_at: now, updated_at: now })
        .eq('id', batch.id).eq('status', 'printed')
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'Only a printed batch can be marked collected.' }, { status: 409 })
      if (appIds.length) {
        await service.from('applications').update({ print_status: 'collected', updated_at: now }).in('id', appIds).eq('print_status', 'printed')
      }
      await logPrintEvent(service, batch.id, userId, role, 'collected', note)
      return NextResponse.json({ ok: true })
    }

    case 'cancel': {
      if (!canSendBatches(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', batch.id).eq('status', 'sent')
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'Only a batch still awaiting print can be cancelled.' }, { status: 409 })
      if (appIds.length) {
        await service.from('applications').update({ print_status: 'not_queued', updated_at: now }).in('id', appIds).eq('print_status', 'queued')
        // Free the cards so they can be put in a new batch.
        await service.from('print_batch_items').delete().eq('batch_id', batch.id)
      }
      await logPrintEvent(service, batch.id, userId, role, 'cancelled', note)
      return NextResponse.json({ ok: true })
    }

    case 'reprint': {
      if (!note) return NextResponse.json({ error: 'Please give a reason for the reprint.' }, { status: 400 })
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'sent', updated_at: now })
        .eq('id', batch.id).in('status', ['printed', 'collected'])
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'Only a printed or collected batch can be sent back for reprint.' }, { status: 409 })
      if (appIds.length) {
        await service.from('applications').update({ print_status: 'queued', updated_at: now }).in('id', appIds).in('print_status', ['printed', 'collected'])
      }
      await logPrintEvent(service, batch.id, userId, role, 'reprint_requested', note)
      try {
        const { data: ict } = await service.from('profiles').select('phone').eq('role', 'ict')
        const phones = (ict ?? []).map((p) => p.phone).filter(Boolean) as string[]
        if (phones.length) await sendSms(phones, `CJTF Portal: reprint requested for ${batch.batch_no} (${batch.sector_command} / ${batch.sub_sector}).`)
      } catch { /* ignore */ }
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
