import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { verifyTransaction } from '@/lib/paystack'
import { notifyPaymentComplete } from '@/lib/notifications'

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
    .select('id, application_id, type')
    .eq('paystack_reference', reference)
    .single()

  if (!payment) return NextResponse.json({ paid: false })

  await service.from('payments').update({
    status: 'success',
    paid_at: new Date().toISOString(),
  }).eq('id', payment.id)

  // Check if both paid
  const { data: allPayments } = await service
    .from('payments')
    .select('type, status')
    .eq('application_id', payment.application_id)
    .eq('status', 'success')

  const types = allPayments?.map((p) => p.type) ?? []
  const bothPaid = types.includes('id_card') && types.includes('training')

  if (bothPaid) {
    await notifyPaymentComplete(service, payment.application_id)
  }

  return NextResponse.json({ paid: true, bothPaid })
}
