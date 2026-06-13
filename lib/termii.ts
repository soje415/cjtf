const TERMII_API_KEY = process.env.TERMII_API_KEY ?? ''
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID ?? 'CJTF-NG'
const TERMII_URL = 'https://api.ng.termii.com/api/sms/send'

function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return '234' + digits.slice(1)
  return '234' + digits
}

export async function sendSms(to: string | string[], message: string): Promise<void> {
  if (!TERMII_API_KEY) return

  const numbers = Array.isArray(to) ? to : [to]
  const formatted = numbers.map(toInternational).filter(Boolean)
  if (formatted.length === 0) return

  await Promise.allSettled(
    formatted.map((number) =>
      fetch(TERMII_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TERMII_API_KEY,
          to: number,
          from: TERMII_SENDER_ID,
          sms: message,
          type: 'plain',
          channel: 'generic',
        }),
      })
    )
  )
}
