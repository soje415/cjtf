import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession, logPrintEvent } from '@/lib/print-batches-server'
import { canSendBatches, canViewBatches } from '@/lib/print-batches'
import { sendSms } from '@/lib/termii'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH: advance a batch. Body: { action, note? }
//   forward    — Admin sends INT's batch to ICT      (with_admin → with_ict)
//   return     — Admin hands it back to INT          (with_admin → cancelled, applicants released)
//   cancel     — INT (with_admin) / Admin (either)   (→ cancelled, applicants released)
//   downloaded — ICT opened/downloaded the print file (audit only)
//   printed    — ICT, once every card is generated   (with_ict → printed)
//   collected  — cards handed over                   (printed → collected)
//   reprint    — printed|collected → with_ict, note required
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
  const notifyRole = async (r: string, message: string) => {
    try {
      const { data: ps } = await service.from('profiles').select('phone').eq('role', r)
      const phones = (ps ?? []).map((p) => p.phone).filter(Boolean) as string[]
      if (phones.length) await sendSms(phones, message)
    } catch { /* ignore */ }
  }
  // Put the batch's applicants back in the INT/Admin queue.
  const releaseApplicants = async () => {
    if (appIds.length) {
      await service.from('applications').update({ print_status: 'not_queued', updated_at: now }).in('id', appIds).eq('print_status', 'queued')
      await service.from('print_batch_items').delete().eq('batch_id', batch.id)
    }
  }
  const label = `${batch.batch_no} (${batch.sector_command} / ${batch.sub_sector})`

  switch (action) {
    case 'forward': {
      if (role !== 'admin') return NextResponse.json({ error: 'Only Admin can forward a batch to ICT.' }, { status: 403 })
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'with_ict', forwarded_by: userId, forwarded_at: now, updated_at: now })
        .eq('id', batch.id).eq('status', 'with_admin')
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'This batch is not awaiting Admin.' }, { status: 409 })
      await logPrintEvent(service, batch.id, userId, role, 'forwarded', note)
      await notifyRole('ict', `CJTF Portal: batch ${label}, ${batch.card_count} applicant(s), is ready for ID generation.`)
      return NextResponse.json({ ok: true })
    }

    case 'return': {
      if (role !== 'admin') return NextResponse.json({ error: 'Only Admin can return a batch to INT.' }, { status: 403 })
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', batch.id).eq('status', 'with_admin')
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'This batch is not awaiting Admin.' }, { status: 409 })
      await releaseApplicants()
      await logPrintEvent(service, batch.id, userId, role, 'returned', note)
      await notifyRequester(`CJTF Portal: Admin returned batch ${label} to you${note ? `: ${note}` : '.'}`)
      return NextResponse.json({ ok: true })
    }

    case 'cancel': {
      if (!canSendBatches(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      // INT can only pull a batch back while it is still with Admin.
      const allowed = role === 'admin' ? ['with_admin', 'with_ict'] : ['with_admin']
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', batch.id).in('status', allowed)
        .select('id').maybeSingle()
      if (!moved) {
        return NextResponse.json(
          { error: role === 'admin' ? 'This batch can no longer be cancelled.' : 'Only a batch still awaiting Admin can be cancelled by INT.' },
          { status: 409 }
        )
      }
      await releaseApplicants()
      await logPrintEvent(service, batch.id, userId, role, 'cancelled', note)
      return NextResponse.json({ ok: true })
    }

    case 'downloaded': {
      if (role !== 'ict') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await logPrintEvent(service, batch.id, userId, role, 'downloaded', note)
      return NextResponse.json({ ok: true })
    }

    case 'printed': {
      if (role !== 'ict') return NextResponse.json({ error: 'Only ICT can mark a batch printed.' }, { status: 403 })
      if (batch.status !== 'with_ict') return NextResponse.json({ error: 'This batch is not with ICT.' }, { status: 409 })
      // Every applicant must have their card generated before the batch can be printed.
      const { data: pending } = appIds.length
        ? await service
            .from('applications').select('id')
            .in('id', appIds)
            .or('status.neq.COMPLETED,id_card_pdf_url.is.null')
        : { data: [] as { id: string }[] }
      if ((pending?.length ?? 0) > 0) {
        return NextResponse.json({ error: `${pending!.length} applicant(s) in this batch still need their ID card generated.` }, { status: 409 })
      }
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'printed', printed_by: userId, printed_at: now, updated_at: now })
        .eq('id', batch.id).eq('status', 'with_ict')
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'This batch is not with ICT.' }, { status: 409 })
      if (appIds.length) {
        await service.from('applications').update({ print_status: 'printed', updated_at: now }).in('id', appIds).eq('print_status', 'queued')
      }
      await logPrintEvent(service, batch.id, userId, role, 'printed', note)
      await notifyRequester(`CJTF Portal: ${batch.card_count} ID card(s) for ${label} have been printed by ICT.`)
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

    case 'reprint': {
      if (!note) return NextResponse.json({ error: 'Please give a reason for the reprint.' }, { status: 400 })
      const { data: moved } = await service
        .from('print_batches')
        .update({ status: 'with_ict', updated_at: now })
        .eq('id', batch.id).in('status', ['printed', 'collected'])
        .select('id').maybeSingle()
      if (!moved) return NextResponse.json({ error: 'Only a printed or collected batch can be sent back for reprint.' }, { status: 409 })
      if (appIds.length) {
        await service.from('applications').update({ print_status: 'queued', updated_at: now }).in('id', appIds).in('print_status', ['printed', 'collected'])
      }
      await logPrintEvent(service, batch.id, userId, role, 'reprint_requested', note)
      await notifyRole('ict', `CJTF Portal: reprint requested for ${label}.`)
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
