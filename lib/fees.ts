/**
 * Single source of truth for what the portal charges.
 *
 * These used to be re-declared in seven files with defaults that disagreed:
 * lib/notifications.ts validated against ₦250 + ₦250 while the payment screen
 * advertised ₦5,000 + ₦10,000, so what an applicant was told to pay and what
 * the code accepted as full payment were set independently. Import from here.
 *
 * Amounts are in KOBO (₦1 = 100 kobo) because that is what both Paystack and
 * Hyparrow take, and what payments.amount stores.
 */

/**
 * One combined registration fee per applicant — ₦5,000.
 *
 * Superseded the old two-payment split (ID card + training). Existing rows of
 * the legacy types are still honoured as full payment, see isApplicationPaid().
 */
export const REGISTRATION_FEE_KOBO = Number(
  process.env.NEXT_PUBLIC_REGISTRATION_FEE_KOBO ?? 500_000
)

/** One registration fee per CJTF office — ₦10,000. */
export const OFFICE_FEE_KOBO = Number(process.env.NEXT_PUBLIC_OFFICE_FEE_KOBO ?? 1_000_000)

/**
 * Reduced fee for already-recognised members being digitised into the portal
 * — ₦3,000, just for the ID card, since they skip INT screening entirely.
 */
export const LEGACY_REGISTRATION_FEE_KOBO = Number(
  process.env.NEXT_PUBLIC_LEGACY_REGISTRATION_FEE_KOBO ?? 300_000
)

/** Which registration fee applies to a given applicant. */
export function feeForMembershipType(type: 'new' | 'legacy'): number {
  return type === 'legacy' ? LEGACY_REGISTRATION_FEE_KOBO : REGISTRATION_FEE_KOBO
}

/** Render a kobo amount as naira for display: 500000 -> "₦5,000". */
export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`
}

/**
 * Is the "mark as paid without paying" bypass available?
 *
 * This exists so the flow past payment can be exercised end to end while
 * Hyparrow is being tested. It was previously hard-disabled whenever
 * NODE_ENV === 'production', which meant it could never be used on the
 * deployed site — now it is an explicit opt-in instead.
 *
 * ⚠️ Turning this on in production lets ANY signed-in user advance their own
 * application or office registration past payment without paying. It is a
 * testing tool, not a feature: unset NEXT_PUBLIC_ALLOW_PAYMENT_BYPASS once
 * live payments are confirmed working.
 */
export function paymentBypassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_PAYMENT_BYPASS === 'true'
}

/**
 * Has an application been paid for in full?
 *
 * Accepts either the current single 'registration' payment or the legacy
 * 'id_card' + 'training' pair, so applicants who paid under the old two-fee
 * scheme keep their completed status and don't get asked to pay again.
 */
export function isApplicationPaid(types: readonly string[]): boolean {
  if (types.includes('registration')) return true
  return types.includes('id_card') && types.includes('training')
}
