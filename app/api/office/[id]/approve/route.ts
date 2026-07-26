import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

// POST: Admin decision on an office registration awaiting approval.
//  body: { decision: 'approve' | 'reject', note }
//  approve → APPROVED_GENERATING_CERT, then handed to the ICT section, who
//            assign the permit number and generate/print the permit.
//  reject  → REJECTED (rejected_by_role = 'admin')
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { decision, note } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: reg } = await service
    .from('office_registrations')
    .select('id, status, first_name, last_name, phone_number, office_name')
    .eq('id', params.id)
    .single()
  if (!reg || reg.status !== 'PENDING_ADMIN_APPROVAL') {
    return NextResponse.json({ error: 'Invalid registration state' }, { status: 400 })
  }

  const fullName = `${reg.first_name} ${reg.last_name}`

  if (decision === 'reject') {
    if (!note?.trim()) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
    await service.from('office_registrations').update({
      status: 'REJECTED',
      rejected_by_role: 'admin',
      rejected_at: new Date().toISOString(),
      rejection_reason: note.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)
    await service.from('office_registration_notes').insert({
      registration_id: params.id, staff_id: user.id, note: note.trim(), action: 'admin_rejected',
    })
    if (reg.phone_number) {
      await sendSms(
        reg.phone_number,
        `CJTF Portal: We're sorry, ${fullName}. Your office registration "${reg.office_name}" was not approved. Reason: ${note.trim()}`
      ).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  // Approve → hand off to ICT for permit generation/printing (permit number is
  // assigned by ICT, not here).
  const { error: updErr } = await service.from('office_registrations').update({
    status: 'APPROVED_GENERATING_CERT',
    admin_approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  await service.from('office_registration_notes').insert({
    registration_id: params.id, staff_id: user.id,
    note: note?.trim() || 'Approved by Admin/Command. Forwarded to ICT for permit issuance.', action: 'admin_approved',
  })

  // Alert ICT that a permit is ready to be generated/printed.
  const { data: ictOfficers } = await service.from('profiles').select('phone').eq('role', 'ict')
  const ictPhones = (ictOfficers ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    ictPhones,
    `CJTF Portal: Office registration "${reg.office_name}" (${fullName}) was approved by Admin and is ready for permit generation/printing.`
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
