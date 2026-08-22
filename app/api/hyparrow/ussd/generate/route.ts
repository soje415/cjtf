import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateUssdCode } from '@/lib/hyparrow-pay'
import { feeForMembershipType } from '@/lib/fees'
import { randomBytes } from 'crypto'
import { canRegister } from '@/lib/roles'

function ref(prefix: string) {
  return `${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`
}

// POST /api/hyparrow/ussd/generate — generate a USSD dial code for the signed-in
// applicant's application fee. The customer dials the returned code to pay;
// settlement arrives via the Hyparrow webhook (there is no USSD status endpoint).
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { applicationId, bankCode } = await req.json().catch(() => ({}))
  if (!applicationId || !bankCode) {
    return NextResponse.json({ error: 'Missing applicationId or bankCode' }, { status: 400 })
  }

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
  // USSD amount is expressed in NAIRA as a string (see docs), unlike OPay's kobo.
  const amountNaira = String(Math.round(amount / 100))
  const reference = ref('CJTF-USSD')

  let ussdCode = ''
  try {
    const res = await generateUssdCode(amountNaira, bankCode, reference)
    ussdCode = res.data?.ussdCode ?? ''
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'USSD generation failed' },
      { status: 502 }
    )
  }
  if (!ussdCode) {
    return NextResponse.json({ error: 'Could not generate a USSD code' }, { status: 502 })
  }

  await service.from('payments').insert({
    application_id: applicationId,
    applicant_id: app.applicant_id,
    type: 'registration',
    amount,
    paystack_reference: reference,
    status: 'pending',
  })

  return NextResponse.json({ ussdCode, reference, amount })
}
