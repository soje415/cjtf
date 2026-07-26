const TERMII_API_KEY = process.env.TERMII_API_KEY ?? ''
// KXSAlerts is the approved sender ID on this Termii account (KRYSTALLX SHEILD).
// CJTF-NG is NOT registered and would silently fail if used.
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID ?? 'KXSAlerts'
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

  // 'generic' is the routed channel on this account (confirmed live); 'dnd' returns
  // "Country Inactive" until Termii activates it.
  await Promise.allSettled(
    formatted.map(async (number) => {
      try {
        const res = await fetch(TERMII_URL, {
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
        // Termii returns 4xx with { message } on hard failure, but ALSO returns
        // 200 with code !== "ok" on soft failures (DND, bad number, no route).
        // Inspect the body either way so nothing disappears into allSettled.
        const body = await res.text().catch(() => '')
        let parsed: { code?: string; message_id?: string; message?: string } = {}
        try { parsed = JSON.parse(body) } catch { /* non-JSON body */ }
        if (!res.ok || (parsed.code && parsed.code !== 'ok')) {
          console.error(`[termii] send to ${number} failed (${res.status}): ${body}`)
        } else {
          console.log(`[termii] sent to ${number} (id ${parsed.message_id ?? 'n/a'})`)
        }
      } catch (err) {
        console.error(`[termii] send to ${number} threw:`, err)
      }
    })
  )
}
