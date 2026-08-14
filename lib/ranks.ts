// CJTF rank structure, highest to lowest.
//
// The stored value is the exact string printed on the ID card, so these labels
// are the source of truth — changing one here changes what future cards say
// without touching cards already issued (the rank is copied onto the
// application row at approval, not looked up at print time).
export const CJTF_RANKS = [
  'CG',
  'DCG',
  'ACG',
  'CC',
  'DCC',
  'ACC',
  'CSC',
  'SC',
  'ASC 2',
  'ASC 1',
  'Chief Inspector',
  'Assistant Chief Inspector',
  'Sergeant',
  'Corporal',
  'Constable',
] as const

export type CjtfRank = (typeof CJTF_RANKS)[number]

// New intakes normally start at the bottom of the structure, so the pickers
// open on Constable rather than making INT scroll to the common case.
export const DEFAULT_RECOMMENDED_RANK: CjtfRank = 'Constable'

// Cards issued before rank assignment existed carry no rank, and reprinting one
// must not leave a blank line on the card face.
export const RANK_FALLBACK = 'VOLUNTEER MEMBER'

export function isValidRank(value: unknown): value is CjtfRank {
  return typeof value === 'string' && (CJTF_RANKS as readonly string[]).includes(value)
}

// The card prints ranks in caps to match the rest of the card's typography.
export function rankForCard(rank: string | null | undefined): string {
  const trimmed = (rank ?? '').trim()
  return trimmed ? trimmed.toUpperCase() : RANK_FALLBACK
}
