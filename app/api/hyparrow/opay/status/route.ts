import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOpayPaymentStatus } from '@/lib/hyparrow-pay'
import { notifyPaymentComplete } from '@/lib/notifications'

// POST /api/hyparrow/opay/status — confirm an OPay redirect payment settled and,
// if so, advance the application. Idempotent (payment row + status guard).
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reference } = await req.json().catch(() => ({}))
  if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

  const service = createServiceClient()
  const { data: payment } = await service
    .from('payments')
    .select('id, application_id, applicant_id, status')
    .eq('paystack_reference', reference)
    .single()

  if (!payment || payment.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (payment.status === 'success') return NextResponse.json({ paid: true })

  let paid = false
  try {
    const status = await getOpayPaymentStatus(reference)
    paid = !!status.paid
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'OPay status check failed' },
      { status: 502 }
    )
  }

  if (!paid) return NextResponse.json({ paid: false })

  await service.from('payments').update({
    status: 'success',
    paid_at: new Date().toISOString(),
  }).eq('id', payment.id)

  const advanced = await notifyPaymentComplete(service, payment.application_id)
  return NextResponse.json({ paid: true, advanced })
}
