import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { verifyTransaction } from '@/lib/paystack'
import { notifyPaymentComplete } from '@/lib/notifications'
import { isApplicationPaid } from '@/lib/fees'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reference } = await req.json()
  if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

  const tx = await verifyTransaction(reference)
  if (tx.status !== 'success') return NextResponse.json({ paid: false })

  const service = createServiceClient()

  const { data: payment } = await service
    .from('payments')
    .select('id, application_id, type, applicant_id')
    .eq('paystack_reference', reference)
    .single()

  if (!payment) return NextResponse.json({ paid: false })

  // A user may only confirm their own payment — otherwise knowing someone
  // else's reference would let them mark it success on the victim's behalf.
  if (payment.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await service.from('payments').update({
    status: 'success',
    paid_at: new Date().toISOString(),
  }).eq('id', payment.id)

  // Check whether the application is now paid in full
  const { data: allPayments } = await service
    .from('payments')
    .select('type, status')
    .eq('application_id', payment.application_id)
    .eq('status', 'success')

  const types = allPayments?.map((p) => p.type) ?? []
  const fullyPaid = isApplicationPaid(types)

  if (fullyPaid) {
    await notifyPaymentComplete(service, payment.application_id)
  }

  return NextResponse.json({ paid: true, fullyPaid })
}
