import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { creditOfficeRegistrationPayment } from '@/lib/notifications'

const OFFICE_FEE = Number(process.env.NEXT_PUBLIC_OFFICE_FEE_KOBO ?? 50000)

/**
 * DEV ONLY. Simulates a virtual-account credit for an office registration so the
 * full flow can be exercised without real money (live VA issuance is currently
 * blocked vendor-side). Hard-disabled in production. Calls the shared credit
 * logic directly, bypassing the Hyparrow signature + transaction lookup.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (process.env.NODE_ENV === 'production') {
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
    amountKobo: OFFICE_FEE,
    reference: `SIM-${Date.now()}`,
  })

  return NextResponse.json({ ok: true, ...result })
}
