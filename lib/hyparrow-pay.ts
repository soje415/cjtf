// Hyparrow payments client — server-side only. Issues a dedicated virtual
// account (NUBAN, settled on Wema) per applicant and looks up transactions so
// incoming credits can be re-verified before we trust a webhook. Never import
// from a client component: it uses the secret key.
//
// Host note: the published docs say api.hyparrow.com, but per our KYC
// integration the live host is api.hyparrow.cloud (.com serves a bad cert).
// We reuse the same HYPARROW_BASE_URL / keys as lib/hyparrow.ts.

import { createHmac, timingSafeEqual } from 'crypto'

const BASE_URL = process.env.HYPARROW_BASE_URL || 'https://api.hyparrow.cloud/api/v1'
const API_KEY = process.env.HYPARROW_API_KEY
const API_SECRET = process.env.HYPARROW_API_SECRET

export interface HyparrowCustomer {
  // The live API returns `id` (a UUID) and `customerCode` (HYP_…) — NOT
  // `customerId` as the docs claim. The virtual-account endpoint and the webhook
  // (data.customerId) both key off the UUID `id`.
  id: string
  customerCode: string
}

export interface VirtualAccount {
  accountNumber: string
  accountName: string
  bankName: string
  bankCode: string
}

// The list endpoint returns the full customer, including VA fields once issued.
export interface HyparrowCustomerRecord {
  id: string
  customerCode: string
  email?: string
  phoneNumber?: string
  accountNumber?: string
  accountName?: string
  bankName?: string
  bankCode?: string
}

export interface HyparrowTransaction {
  status: string // "completed" on success
  amount: number // kobo
  reference: string
  customerId: string
}

// Payment endpoints are single-wrapped: { success, message, data: {...} }.
// Error responses vary: some use { success:false, message }, others (e.g.
// "customer already exists") use { success:false, error } instead — check both.
interface Envelope<T> {
  success?: boolean
  message?: string
  error?: string
  data?: T
}

async function call<T>(method: 'POST' | 'GET', path: string, body?: Record<string, unknown>): Promise<T> {
  if (!API_KEY || !API_SECRET) {
    throw new Error('Hyparrow payments are not configured (missing API key/secret).')
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-api-secret': API_SECRET,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })

  let json: Envelope<T>
  try {
    json = (await res.json()) as Envelope<T>
  } catch {
    throw new Error('Unexpected response from Hyparrow.')
  }

  if (!res.ok || json.success === false || !json.data) {
    throw new Error(json.message || json.error || `Hyparrow request failed (${res.status}).`)
  }
  return json.data
}

export function createCustomer(params: {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  dateOfBirth?: string
}): Promise<HyparrowCustomer> {
  return call<HyparrowCustomer>('POST', '/customers', params)
}

export function createVirtualAccount(customerId: string, bankCode: string): Promise<VirtualAccount> {
  return call<VirtualAccount>('POST', '/customers/virtual-account', { customerId, bankCode })
}

export function getTransaction(transactionId: string): Promise<HyparrowTransaction> {
  return call<HyparrowTransaction>('GET', `/transactions/${encodeURIComponent(transactionId)}`)
}

/**
 * Find an already-created customer by email or phone. Used to recover when
 * createCustomer returns "already exists" (a customer was created upstream but
 * our DB save didn't land) — Hyparrow has no email/phone query param, so we page
 * the list (prototype scale; a few pages is plenty). Returns the record, which
 * includes the VA fields if one was already issued.
 */
export async function findCustomer(params: { email?: string; phoneNumber?: string }): Promise<HyparrowCustomerRecord | null> {
  const email = params.email?.toLowerCase()
  const phone = params.phoneNumber
  for (let page = 1; page <= 5; page++) {
    const list = await call<HyparrowCustomerRecord[]>('GET', `/customers?page=${page}&limit=100`)
    const match = list.find(
      (c) => (email && c.email?.toLowerCase() === email) || (phone && c.phoneNumber === phone)
    )
    if (match) return match
    if (list.length < 100) break // last page
  }
  return null
}

/**
 * Verify a webhook came from Hyparrow: HMAC-SHA512 of the RAW request body using
 * the webhook secret, compared timing-safe to the X-Hyparrow-Signature header.
 * Pass the raw (unparsed) body string — parsing first alters the bytes.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.HYPARROW_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
