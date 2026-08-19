import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { creditVirtualAccountPayment } from '@/lib/notifications'
import { feeForMembershipType, paymentBypassEnabled } from '@/lib/fees'


/**
 * Simulates a virtual-account credit for the signed-in applicant so the full
 * payment flow (clear the fee → advance to ICT → SMS) can be exercised without
 * moving real money. Bypasses the Hyparrow signature + transaction lookup by
 * calling the shared credit logic directly.
 *
 * Gated on NEXT_PUBLIC_ALLOW_PAYMENT_BYPASS so it can be used against the
 * deployed site while Hyparrow is being tested — see paymentBypassEnabled().
 */
export async function POST() {
  if (!paymentBypassEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: app } = await service
    .from('applications')
    .select('id, applicant_id, status, membership_type')
    .eq('applicant_id', user.id)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'No application found' }, { status: 404 })
  if (app.status !== 'PENDING_PAYMENT') return NextResponse.json({ paid: true })

  const result = await creditVirtualAccountPayment(service, {
    application: { id: app.id, applicant_id: app.applicant_id, membership_type: app.membership_type },
    amountKobo: feeForMembershipType(app.membership_type),
    reference: `SIM-${Date.now()}`,
  })

  return NextResponse.json({ ok: true, ...result })
}
