// Whitelist for post-auth redirect targets carried via a `next` query/form
// param, so office registration can send a user straight back into its own
// flow instead of the recruitment application dashboard. Only same-origin
// paths under /portal/applicant/ are honoured — anything else is ignored to
// avoid an open redirect.
const ALLOWED_NEXT = ['/portal/applicant/office']

export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null
  return ALLOWED_NEXT.includes(next) ? next : null
}

/**
 * Validate an arbitrary post-auth redirect path for the /auth/callback route.
 *
 * Unlike safeNext() (a tight whitelist for login/register deep-links), the
 * callback needs to honour any same-origin path we ourselves emitted — e.g.
 * `/auth/reset-password` from the forgot-password email. It must still reject
 * anything that would escape the origin: an absolute URL, a protocol-relative
 * `//host`, a userinfo `@` (which makes `https://x@evil.com` parse as host
 * `evil.com`), or a backslash (browser-normalised to `/`).
 */
export function safeRedirectPath(next: string | null | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (/[\\@]/.test(next)) return null
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return null
  return next
}

/**
 * A same-origin `/portal/applicant/*` path, for post-verification return links
 * (e.g. send the applicant back to their in-progress form after they verify
 * their phone). Same-origin safety from safeRedirectPath, scoped to the
 * applicant portal so it can't be aimed at auth/staff paths.
 */
export function safeApplicantNext(next: string | null | undefined): string | null {
  const p = safeRedirectPath(next)
  return p && p.startsWith('/portal/applicant/') ? p : null
}
