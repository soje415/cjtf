// Where the portal answers from, for links that outlive the request that made
// them — QR codes printed onto ID cards and permits above all.
//
// A QR is permanent: whatever host it encodes is the host that card points at
// for the next four years. A card captured from a dev session with
// NEXT_PUBLIC_APP_URL unset (or pointing at localhost) would ship a dead QR, so
// this module refuses both cases and falls back to production instead.
//
// Keep in sync with PORTAL_URL in the public website (cjtf-website/src/site.config.ts).
const PRODUCTION_PORTAL_URL = 'https://portal.cjtfnigeria.com'

function resolvePortalUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  if (!raw) return PRODUCTION_PORTAL_URL
  // A localhost QR is worse than no QR — it scans, and then goes nowhere.
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(raw)) {
    return PRODUCTION_PORTAL_URL
  }
  return raw
}

export const PORTAL_URL = resolvePortalUrl()

/** Host only (no scheme) — what gets printed as readable text on a card. */
export const PORTAL_HOST = PORTAL_URL.replace(/^https?:\/\//, '')

/** Public verification page for an issued member ID card. */
export function memberVerifyUrl(applicationId: string): string {
  return `${PORTAL_URL}/verify/${applicationId}`
}

/** Public verification page for an issued office Operational Permit. */
export function officeVerifyUrl(registrationId: string): string {
  return `${PORTAL_URL}/verify/office/${registrationId}`
}
