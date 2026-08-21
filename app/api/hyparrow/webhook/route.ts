import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/hyparrow-pay'
import {
  creditVirtualAccountPayment,
  creditOfficeRegistrationPayment,
  notifyPaymentComplete,
  notifyOfficePaymentComplete,
} from '@/lib/notifications'

// Hyparrow fires a webhook when a transfer lands on a customer's dedicated
// virtual account. Per the integration guide (§5):
//   1. Verify the signature — this is the trust step; we do not trust an
//      unsigned payload.
//   2. Reconcile on the ACCOUNT NUMBER, not the customer id. The account number
//      may arrive in data.NonCardProviderID (format VIRTUAL|DIRECT|<acctNo>),
//      data.RetrievalReferenceNumber, or data.AccountNumber — check in that order.
//   3. Amounts are in kobo and represent the GROSS amount paid (our wallet is
//      credited the net after Hyparrow's 2.5% deposit fee).
//   4. Respond 200 quickly.

// Pull the credited virtual-account number out of the webhook payload, trying
// each documented field in order. NonCardProviderID is pipe-delimited
// (VIRTUAL|DIRECT|<accountNumber>) — take the last segment.
// A live transaction (2026-07-06) showed the provider event uses camelCase
// (nonCardProviderId, retrievalReferenceNumber) rather than the guide's
// PascalCase — accept both.
function str(data: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = data[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function extractAccountNumber(data: Record<string, unknown>): string | null {
  const nonCard = str(data, 'NonCardProviderID', 'nonCardProviderId', 'nonCardProviderID')
  if (nonCard) {
    const parts = nonCard.split('|')
    const last = parts[parts.length - 1]?.trim()
    if (last) return last
  }
  return (
    str(data, 'RetrievalReferenceNumber', 'retrievalReferenceNumber') ||
    str(data, 'AccountNumber', 'accountNumber') ||
    null
  )
}

// Amount in kobo (gross). Accept the documented lower-case `amount` as well as
// the PascalCase provider variant.
function extractAmountKobo(data: Record<string, unknown>): number | null {
  const raw = data.amount ?? data.Amount ?? data.amountKobo
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function POST(req: Request) {
  // Must read the RAW body before parsing — parsing alters bytes and breaks HMAC.
  const raw = await req.text()
  const signature = req.headers.get('x-hyparrow-signature') || ''

  // The exact payload shape is unverified against a live webhook — capture the
  // first real one so the extractors above can be confirmed. Dev only.
  if (process.env.NODE_ENV !== 'production') {
    console.log('[hyparrow webhook] signature:', signature)
    console.log('[hyparrow webhook] raw body:', raw)
  }

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { event?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const data = event.data ?? {}

  // Refunds, reversals and other non-credit events carry the same
  // accountNumber + amount fields as a credit, so trusting them would credit
  // money on a reversal. Reject known non-credit event/status values; if the
  // provider omits the event type (some do), fall through and rely on the
  // verified signature + the UNIQUE reference idempotency.
  const nonCredit = /reversal|refund|chargeback|debit|failed|reversed/i
  const eventType = typeof event.event === 'string' ? event.event : ''
  const txStatus = str(data, 'status', 'Status', 'transactionStatus')
  if (nonCredit.test(eventType) || nonCredit.test(txStatus)) {
    return NextResponse.json({ ok: true })
  }

  const accountNumber = extractAccountNumber(data)
  const amountKobo = extractAmountKobo(data)

  const service = createServiceClient()

  // OPay / USSD collections have no virtual account — they are reconciled by the
  // merchant reference we stored on a pending payment row. Match that first, so
  // a card/OPay/USSD settlement is credited without an account number.
  const merchantRef = str(
    data,
    'merchantTransactionReference', 'merchantReference', 'transactionReference',
    'reference', 'paymentReference', 'TransactionRef', 'transactionRef'
  )
  if (merchantRef) {
    const { data: payment } = await service
      .from('payments')
      .select('id, application_id, office_registration_id, amount, status')
      .eq('paystack_reference', merchantRef)
      .eq('status', 'pending')
      .maybeSingle()

    if (payment) {
      // amountKobo is absent on some events; only enforce it when present.
      const enough = amountKobo == null || amountKobo >= payment.amount
      if (enough) {
        await service.from('payments').update({
          status: 'success',
          paid_at: new Date().toISOString(),
        }).eq('id', payment.id)
        if (payment.application_id) {
          await notifyPaymentComplete(service, payment.application_id)
        } else if (payment.office_registration_id) {
          await notifyOfficePaymentComplete(service, payment.office_registration_id)
        }
      }
      return NextResponse.json({ ok: true })
    }
  }

  // Bank-transfer credits need a virtual account number to reconcile against.
  if (!accountNumber || amountKobo == null) return NextResponse.json({ ok: true })

  // A unique reference for idempotency. Prefer a provider transaction id when
  // present; otherwise the retrieval reference is a stable per-transaction id.
  const reference =
    str(data, 'TransactionRef', 'transactionId', 'merchantReference', 'paymentReference') ||
    str(data, 'RetrievalReferenceNumber', 'retrievalReferenceNumber') ||
    `${accountNumber}-${amountKobo}`

  // The VA belongs to either a recruitment application or an office
  // registration. Match on the account number we persisted at VA creation.
  const { data: app } = await service
    .from('applications')
    .select('id, applicant_id, membership_type')
    .eq('va_account_number', accountNumber)
    .maybeSingle()

  if (app) {
    await creditVirtualAccountPayment(service, {
      application: { id: app.id, applicant_id: app.applicant_id, membership_type: app.membership_type },
      amountKobo,
      reference,
    })
    return NextResponse.json({ ok: true })
  }

  const { data: reg } = await service
    .from('office_registrations')
    .select('id, registrant_id')
    .eq('va_account_number', accountNumber)
    .maybeSingle()

  if (reg) {
    await creditOfficeRegistrationPayment(service, {
      registration: { id: reg.id, registrant_id: reg.registrant_id },
      amountKobo,
      reference,
    })
  }

  return NextResponse.json({ ok: true })
}
