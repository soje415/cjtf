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
