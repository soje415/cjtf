import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { creditOfficeRegistrationPayment } from '@/lib/notifications'
import { OFFICE_FEE_KOBO, paymentBypassEnabled } from '@/lib/fees'


/**
 * Simulates a virtual-account credit for an office registration so the full flow
 * can be exercised without real money. Calls the shared credit logic directly,
 * bypassing the Hyparrow signature + transaction lookup.
 *
 * Gated on NEXT_PUBLIC_ALLOW_PAYMENT_BYPASS so it can be used against the
 * deployed site while Hyparrow is being tested — see paymentBypassEnabled().
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!paymentBypassEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: reg } = await service
    .from('office_registrations')
    .select('id, registrant_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!reg || reg.registrant_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (reg.status !== 'PENDING_PAYMENT') return NextResponse.json({ paid: true })

  const result = await creditOfficeRegistrationPayment(service, {
    registration: { id: reg.id, registrant_id: reg.registrant_id },
    amountKobo: OFFICE_FEE_KOBO,
    reference: `SIM-${Date.now()}`,
  })

  return NextResponse.json({ ok: true, ...result })
}
