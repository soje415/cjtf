import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

// POST: INT screening decision on an office registration.
//  body: { decision: 'pass' | 'reject', note }
//  pass   → PENDING_ADMIN_APPROVAL
//  reject → REJECTED (rejected_by_role = 'int')
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { decision, note } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'int') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: reg } = await service
    .from('office_registrations')
    .select('id, status, first_name, last_name, phone_number, office_name')
    .eq('id', params.id)
    .single()
  if (!reg || reg.status !== 'PENDING_INT_SCREENING') {
    return NextResponse.json({ error: 'Invalid registration state' }, { status: 400 })
  }

  if (decision === 'reject') {
    if (!note?.trim()) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
    await service.from('office_registrations').update({
      status: 'REJECTED',
      rejected_by_role: 'int',
      rejected_at: new Date().toISOString(),
      rejection_reason: note.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)
    await service.from('office_registration_notes').insert({
      registration_id: params.id, staff_id: user.id, note: note.trim(), action: 'int_rejected',
    })
    if (reg.phone_number) {
      await sendSms(
        reg.phone_number,
        `CJTF Portal: Your office registration "${reg.office_name}" was not successful at screening. Reason: ${note.trim()}`
      ).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  // Pass → admin approval.
  await service.from('office_registrations').update({
    status: 'PENDING_ADMIN_APPROVAL',
    int_cleared_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)
  await service.from('office_registration_notes').insert({
    registration_id: params.id, staff_id: user.id,
    note: note?.trim() || 'Cleared INT screening.', action: 'int_cleared',
  })

  const { data: admins } = await service.from('profiles').select('phone').eq('role', 'admin')
  const adminPhones = (admins ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    adminPhones,
    `CJTF Portal: Office registration "${reg.office_name}" cleared INT screening and awaits Admin approval.`
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
