import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { creditVirtualAccountPayment, creditOfficeRegistrationPayment } from '@/lib/notifications'
import { feeForMembershipType, OFFICE_FEE_KOBO } from '@/lib/fees'
import { canRegister } from '@/lib/roles'

// ICT/Admin manually records a payment as received (cash at the office, or a
// transfer whose webhook was delayed/failed) and advances the record past
// PENDING_PAYMENT. This is a fallback, not the normal path.
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!canRegister(callerProfile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const applicationId = typeof body?.applicationId === 'string' ? body.applicationId : null
  const officeRegistrationId = typeof body?.officeRegistrationId === 'string' ? body.officeRegistrationId : null

  if (applicationId) {
    const { data: app } = await service
      .from('applications')
      .select('id, applicant_id, membership_type, status')
      .eq('id', applicationId)
      .maybeSingle()
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    if (app.status !== 'PENDING_PAYMENT') return NextResponse.json({ paid: true })

    const result = await creditVirtualAccountPayment(service, {
      application: { id: app.id, applicant_id: app.applicant_id, membership_type: app.membership_type },
      amountKobo: feeForMembershipType(app.membership_type),
      reference: `MANUAL-${Date.now()}`,
    })
    return NextResponse.json({ ok: true, ...result })
  }

  if (officeRegistrationId) {
    const { data: reg } = await service
      .from('office_registrations')
      .select('id, registrant_id, status')
      .eq('id', officeRegistrationId)
      .maybeSingle()
    if (!reg) return NextResponse.json({ error: 'Office registration not found' }, { status: 404 })
    if (reg.status !== 'PENDING_PAYMENT') return NextResponse.json({ paid: true })

    const result = await creditOfficeRegistrationPayment(service, {
      registration: { id: reg.id, registrant_id: reg.registrant_id },
      amountKobo: OFFICE_FEE_KOBO,
      reference: `MANUAL-${Date.now()}`,
    })
    return NextResponse.json({ ok: true, ...result })
  }

  return NextResponse.json({ error: 'Provide applicationId or officeRegistrationId' }, { status: 400 })
}
