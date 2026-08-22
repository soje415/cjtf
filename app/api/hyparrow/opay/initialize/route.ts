import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { initializeOpayPayment } from '@/lib/hyparrow-pay'
import { feeForMembershipType } from '@/lib/fees'
import { randomBytes } from 'crypto'
import { canRegister } from '@/lib/roles'

function ref(prefix: string) {
  return `${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`
}

// POST /api/hyparrow/opay/initialize — start an OPay redirect payment for the
// signed-in applicant's application fee. Mirrors the Paystack initialize flow
// but against Hyparrow's OPay endpoint (https://docs.hyparrow.com/card-payments).
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { applicationId } = await req.json().catch(() => ({}))
  if (!applicationId) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 })

  const service = createServiceClient()
  const { data: app } = await service
    .from('applications')
    .select('id, status, membership_type, applicant_id')
    .eq('id', applicationId)
    .single()

  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const canAct = canRegister(callerProfile?.role)
  if (!app || (app.applicant_id !== user.id && !canAct) || app.status !== 'PENDING_PAYMENT') {
    return NextResponse.json({ error: 'Application not in payment state' }, { status: 400 })
  }

  const amount = feeForMembershipType(app.membership_type)
  const reference = ref('CJTF-OPAY')

  let redirectUrl: string
  try {
    const res = await initializeOpayPayment(amount, reference)
    redirectUrl = res.redirectUrl
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'OPay init failed' },
      { status: 502 }
    )
  }

  await service.from('payments').insert({
    application_id: applicationId,
    applicant_id: app.applicant_id,
    type: 'registration',
    amount,
    paystack_reference: reference,
    status: 'pending',
  })

  return NextResponse.json({ redirectUrl, reference, amount })
}
