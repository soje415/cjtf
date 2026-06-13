import { createHmac } from 'crypto'

const PAYSTACK_BASE = 'https://api.paystack.co'

export async function initializeTransaction(params: {
  email: string
  amount: number
  reference: string
  metadata?: Record<string, unknown>
  callback_url?: string
}) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Paystack init failed')
  return data.data as { authorization_url: string; access_code: string; reference: string }
}

export async function verifyTransaction(reference: string) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Paystack verify failed')
  return data.data as {
    status: string
    amount: number
    reference: string
    metadata: Record<string, unknown>
    customer: { email: string }
  }
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')
  return hash === signature
}
