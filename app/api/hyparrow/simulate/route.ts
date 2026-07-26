import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { creditVirtualAccountPayment } from '@/lib/notifications'

const ID_CARD_FEE = Number(process.env.NEXT_PUBLIC_ID_CARD_FEE_KOBO ?? 25000)
const TRAINING_FEE = Number(process.env.NEXT_PUBLIC_TRAINING_FEE_KOBO ?? 25000)

/**
 * DEV ONLY. Simulates a virtual-account credit for the signed-in applicant so we
 * can exercise the full payment flow (clear both fees → advance to ICT → SMS)
 * without moving real money. Hard-disabled in production. Bypasses the Hyparrow
 * signature + transaction lookup by calling the shared credit logic directly.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: app } = await service
    .from('applications')
    .select('id, applicant_id, status')
    .eq('applicant_id', user.id)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'No application found' }, { status: 404 })
  if (app.status !== 'PENDING_PAYMENT') return NextResponse.json({ paid: true })

  const result = await creditVirtualAccountPayment(service, {
    application: { id: app.id, applicant_id: app.applicant_id },
    amountKobo: ID_CARD_FEE + TRAINING_FEE,
    reference: `SIM-${Date.now()}`,
  })

  return NextResponse.json({ ok: true, ...result })
}
