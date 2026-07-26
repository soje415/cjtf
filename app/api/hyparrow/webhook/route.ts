import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/hyparrow-pay'
import { creditVirtualAccountPayment, creditOfficeRegistrationPayment } from '@/lib/notifications'

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
  const accountNumber = extractAccountNumber(data)
  const amountKobo = extractAmountKobo(data)
  if (!accountNumber || amountKobo == null) return NextResponse.json({ ok: true })

  // A unique reference for idempotency. Prefer a provider transaction id when
  // present; otherwise the retrieval reference is a stable per-transaction id.
  const reference =
    str(data, 'TransactionRef', 'transactionId', 'merchantReference', 'paymentReference') ||
    str(data, 'RetrievalReferenceNumber', 'retrievalReferenceNumber') ||
    `${accountNumber}-${amountKobo}`

  const service = createServiceClient()

  // The VA belongs to either a recruitment application or an office
  // registration. Match on the account number we persisted at VA creation.
  const { data: app } = await service
    .from('applications')
    .select('id, applicant_id')
    .eq('va_account_number', accountNumber)
    .maybeSingle()

  if (app) {
    await creditVirtualAccountPayment(service, {
      application: { id: app.id, applicant_id: app.applicant_id },
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
