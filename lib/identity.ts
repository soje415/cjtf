// Identity (KYC) display helpers. Verification is BVN-only; a BVN is a financial
// identifier, so staff screens show it masked and it is never printed on a card.
// Records verified earlier by NIN keep showing their NIN.

export function maskDigits(value: string | null | undefined): string {
  const v = (value ?? '').replace(/\D/g, '')
  if (!v) return '—'
  return v.length <= 4 ? v : `${'•'.repeat(v.length - 4)}${v.slice(-4)}`
}

/** [label, value] pair for review screens. */
export function identityRow(a: { bvn?: string | null; nin?: string | null }): [string, string] {
  if (a.bvn) return ['BVN', maskDigits(a.bvn)]
  if (a.nin) return ['NIN (earlier record)', a.nin]
  return ['BVN', '—']
}
