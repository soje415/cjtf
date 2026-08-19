import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { initializeTransaction } from '@/lib/paystack'
import { feeForMembershipType } from '@/lib/fees'
import { randomBytes } from 'crypto'
function nanoid(len: number) { return randomBytes(len).toString('hex').slice(0, len).toUpperCase() }

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { applicationId } = await req.json()
  if (!applicationId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  // Applicants pay one combined registration fee; the old id_card/training split
  // is no longer initiable, only readable on historical rows.
  const type = 'registration'

  // Verify the application belongs to this user and is in PENDING_PAYMENT
  const service = createServiceClient()
  const { data: app } = await service
    .from('applications')
    .select('id, status, email, membership_type')
    .eq('id', applicationId)
    .eq('applicant_id', user.id)
    .single()

  if (!app || app.status !== 'PENDING_PAYMENT') {
    return NextResponse.json({ error: 'Application not in payment state' }, { status: 400 })
  }

  // Check not already paid
  const { data: existing } = await service
    .from('payments')
    .select('id')
    .eq('application_id', applicationId)
    .eq('type', type)
    .eq('status', 'success')
    .single()

  if (existing) return NextResponse.json({ error: 'Already paid' }, { status: 400 })

  const amount = feeForMembershipType(app.membership_type)

  const reference = `CJTF-${type.toUpperCase()}-${nanoid(10).toUpperCase()}`

  const tx = await initializeTransaction({
    email: app.email || user.email!,
    amount,
    reference,
    metadata: { application_id: applicationId, payment_type: type, user_id: user.id },
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/applicant/payment`,
  })

  // Store pending payment
  await service.from('payments').insert({
    application_id: applicationId,
    applicant_id: user.id,
    type,
    amount,
    paystack_reference: reference,
    paystack_access_code: tx.access_code,
    status: 'pending',
  })

  return NextResponse.json({ reference, access_code: tx.access_code, amount })
}
