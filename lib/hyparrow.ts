// Hyparrow KYC client — server-side only. Verifies a NIN or BVN against the
// government record and returns a normalized identity. Never import this from a
// client component: it uses the secret key.
//
// API host is api.hyparrow.cloud (the docs say .com, but .com is not the live
// integration host). Auth is via x-api-key + x-api-secret headers.

const BASE_URL = process.env.HYPARROW_BASE_URL || 'https://api.hyparrow.cloud/api/v1'
const API_KEY = process.env.HYPARROW_API_KEY
const API_SECRET = process.env.HYPARROW_API_SECRET

export type IdentityMethod = 'nin' | 'bvn'

export interface VerifiedIdentity {
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string // YYYY-MM-DD
  gender: string // normalized to 'male' | 'female' (matches the form's Select values)
  phoneNumber: string
  /** Base64-encoded JPEG passport photo (no data: prefix), if the record has one. */
  photoBase64: string
}

export interface VerifyResult {
  ok: boolean
  identity?: VerifiedIdentity
  /** Human-readable error for the applicant when ok === false. */
  error?: string
  /**
   * True when the provider itself is unreachable/down (network error, timeout,
   * 5xx, an unfunded wallet, or a non-JSON response) rather than simply having
   * no record for the number. Distinguishes "provider down" from a genuine miss
   * so the error message shown to the applicant is accurate.
   */
  serviceDown?: boolean
}

// The provider wraps everything twice: { success, data: { success, response_code, message, data: {...} } }
interface HyparrowEnvelope {
  success?: boolean
  data?: {
    success?: boolean
    response_code?: string
    statusCode?: number
    message?: string
    data?: Record<string, unknown>
  }
  message?: string
}

function normGender(raw: unknown): string {
  const g = String(raw ?? '').trim().toLowerCase()
  if (g.startsWith('m')) return 'male'
  if (g.startsWith('f')) return 'female'
  return ''
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

// Provider-side failure messages (an unfunded wallet, upstream outage, "service
// is down", etc.) mean the service can't complete a lookup for us. Flag these so
// the applicant sees an accurate "service unavailable" message instead of a
// misleading "no record found" error.
const PROVIDER_DOWN_HINTS = [
  'insufficient', 'balance', 'wallet', 'fund', 'top up', 'top-up',
  'recharge', 'exhausted', 'unavailable', 'maintenance', 'timeout',
  'temporarily', 'try again', 'down', 'service', 'unable', 'failed',
  'error', 'rejected', 'denied', 'blocked', 'not funded', 'unreachable',
]

function isProviderDown(msg: string | undefined): boolean {
  if (!msg) return false
  const m = msg.toLowerCase()
  return PROVIDER_DOWN_HINTS.some((h) => m.includes(h))
}

// Normalize a date of birth to YYYY-MM-DD so the form's <input type="date">
// displays it. Providers return mixed formats (BVN often "DD-Mon-YYYY").
function normDob(raw: unknown): string {
  const s = str(raw)
  if (!s) return ''
  // Already ISO (optionally with a time component) — keep the date part.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // DD-Mon-YYYY / DD Mon YYYY (e.g. 12-Jan-1990)
  const named = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})$/)
  if (named) {
    const mm = MONTHS[named[2].slice(0, 3).toLowerCase()]
    if (mm) return `${named[3]}-${mm}-${named[1].padStart(2, '0')}`
  }
  // DD-MM-YYYY / DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return s // leave as-is if unrecognized; the input simply won't prefill
}

async function call(path: string, body: Record<string, unknown>): Promise<VerifyResult> {
  if (!API_KEY || !API_SECRET) {
    return { ok: false, serviceDown: true, error: 'Identity verification is not configured. Please contact support.' }
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-api-secret': API_SECRET,
      },
      body: JSON.stringify(body),
      // KYC lookups can be slow; don't let them hang the request forever.
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    return { ok: false, serviceDown: true, error: 'The identity verification service is currently unavailable. Please try again shortly.' }
  }

  let json: HyparrowEnvelope
  try {
    json = (await res.json()) as HyparrowEnvelope
  } catch {
    return { ok: false, serviceDown: true, error: 'Unexpected response from the verification service.' }
  }

  const inner = json.data
  const ok = res.ok && (json.success ?? false) && (inner?.response_code === '00' || inner?.success === true)
  if (!ok) {
    const msg = inner?.message || json.message
    // A 5xx / gateway timeout, or a provider-side failure (e.g. an unfunded
    // wallet) means the service is effectively down for us — not that the
    // record is missing. Flag it so the client can offer to defer KYC and move
    // on, while a genuine "no record" stays a hard failure.
    if (res.status >= 500 || isProviderDown(msg)) {
      return { ok: false, serviceDown: true, error: msg || 'The identity verification service is currently unavailable.' }
    }
    return { ok: false, error: msg || 'No record found for the number provided.' }
  }

  const d = inner?.data ?? {}
  return {
    ok: true,
    identity: {
      firstName: str(d.firstName),
      middleName: str(d.middleName),
      lastName: str(d.lastName),
      dateOfBirth: normDob(d.dateOfBirth),
      gender: normGender(d.gender),
      // NIN returns phoneNumber; BVN returns phoneNumber1.
      phoneNumber: str(d.phoneNumber) || str(d.phoneNumber1),
      photoBase64: str(d.image),
    },
  }
}

export function verifyIdentity(method: IdentityMethod, number: string): Promise<VerifyResult> {
  const clean = number.replace(/\D/g, '')
  if (clean.length !== 11) {
    return Promise.resolve({ ok: false, error: `${method.toUpperCase()} must be 11 digits.` })
  }
  return method === 'nin'
    ? call('/kyc/zee/nin', { nin: clean })
    : call('/kyc/zee/bvn/basic', { bvn: clean })
}
