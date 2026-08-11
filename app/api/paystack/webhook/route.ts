import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, verifyTransaction } from '@/lib/paystack'
import { notifyPaymentComplete } from '@/lib/notifications'
import { isApplicationPaid } from '@/lib/fees'

export async function POST(req: Request) {
  const payload = await req.text()
  const signature = req.headers.get('x-paystack-signature') || ''

  if (!verifyWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(payload)
  if (event.event !== 'charge.success') {
    return NextResponse.json({ ok: true })
  }

  const reference = event.data?.reference
  if (!reference) return NextResponse.json({ ok: true })

  const service = createServiceClient()

  // Verify with Paystack API
  const tx = await verifyTransaction(reference)
  if (tx.status !== 'success') return NextResponse.json({ ok: true })

  // Find the pending payment
  const { data: payment } = await service
    .from('payments')
    .select('id, application_id, type, status')
    .eq('paystack_reference', reference)
    .single()

  if (!payment || payment.status === 'success') return NextResponse.json({ ok: true })

  // Mark payment as success
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

  if (isApplicationPaid(types)) {
    await notifyPaymentComplete(service, payment.application_id)
  }

  return NextResponse.json({ ok: true })
}
