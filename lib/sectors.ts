// Sector Command / Sub Sector handling. These fields were free text, so the same
// place arrived as "Garki", "garki ", "GARKI SUB SECTOR"… Everything that groups
// by sector (the print queue) goes through sectorKey(); everything that stores a
// sector goes through normalizeSectorName() so new data stays clean.

const GENERIC_WORDS = /\b(sub[\s-]*sector|sector|command|cmd)\b/g

/** Tidy a typed sector name: trim, collapse spaces, sensible capitalisation.
 *  Short all-caps words (FCT, NSCDC, ABC) are kept as acronyms. */
export function normalizeSectorName(input: string | null | undefined): string {
  const cleaned = (input ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:\-–]+|[\s.,;:\-–]+$/g, '')
    .trim()
  if (!cleaned) return ''
  // An all-caps entry ("GARKI SUB SECTOR") is shouting, not acronyms — title-case
  // it, keeping only known acronyms. Mixed-case entries keep short caps words
  // ("FCT Command") as typed.
  const shouting = !/[a-z]/.test(cleaned)
  return cleaned
    .split(' ')
    .map((w) => {
      if (KNOWN_ACRONYMS.has(w.toUpperCase())) return w.toUpperCase()
      if (!shouting && /^[A-Z0-9&]{2,4}$/.test(w) && !GENERIC_WORD_SET.has(w.toLowerCase())) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

const KNOWN_ACRONYMS = new Set(['FCT', 'CJTF', 'HQ', 'LGA', 'NSCDC', 'FCDA', 'AMAC'])
const GENERIC_WORD_SET = new Set(['sub', 'unit', 'area', 'zone', 'cmd'])

/** Case/spacing/suffix-insensitive grouping key: "Garki Sub Sector" == "garki". */
export function sectorKey(input: string | null | undefined): string {
  return (input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(GENERIC_WORDS, ' ')
    .replace(/[\s-]+/g, ' ')
    .trim()
}

// Sector commands that applicants type several ways, as confirmed by the
// project owner. Keys and values are sectorKey() output. This only affects how
// records are grouped, filtered and labelled — stored text is never rewritten.
const SECTOR_COMMAND_ALIASES: Record<string, string> = {
  '01': '1', '01 gwagwalada': '1',
  '02': '2', '2 gwako': '2', gwako: '2',
  '3 kuje': '3',
  'bwari 9': '9', bwari: '9',
}
const SECTOR_COMMAND_LABELS: Record<string, string> = {
  '1': 'Sector 01 (Gwagwalada)',
  '2': 'Sector 2 (Gwako)',
  '3': 'Sector 3 (Kuje)',
  '9': 'Sector 9 (Bwari)',
}

/** Grouping key for a Sector Command, with the known variants folded together. */
export function sectorCommandKey(input: string | null | undefined): string {
  const key = sectorKey(input)
  return SECTOR_COMMAND_ALIASES[key] ?? key
}

/** Display name for a Sector Command. */
export function sectorCommandName(input: string | null | undefined): string {
  return SECTOR_COMMAND_LABELS[sectorCommandKey(input)] ?? normalizeSectorName(input)
}

// Sub sectors that are spelled several ways inside one Sector Command (typos and
// short forms). Best-guess grouping requested by the project owner. Outer keys are
// sectorCommandKey() output, inner keys and values are sectorKey() output.
const SUB_SECTOR_ALIASES: Record<string, Record<string, string>> = {
  '2': { tungamaje: 'tungan maje' },
  '7': {
    dabana: 'dagbana',
    'gildan mangoro': 'gidan mangoro',
    jikwoi: 'jikwoyi',
    kurud: 'kurudu',
    karachi: 'karshi',
  },
  '9': {
    'dutse alhaji': 'dutse',
    f01: 'f01 kubwa',
    fo1: 'f01 kubwa',
    'kubwa f01': 'f01 kubwa',
    'kuduru sub secto': 'kuduru',
  },
  '10': { gidna: 'guidna' },
}
const SUB_SECTOR_LABELS: Record<string, string> = { provost: 'Provost Command' }

/** Grouping key for a Sub Sector within its Sector Command. */
export function subSectorKey(sector: string | null | undefined, sub: string | null | undefined): string {
  const key = sectorKey(sub)
  return SUB_SECTOR_ALIASES[sectorCommandKey(sector)]?.[key] ?? key
}

/** Display name for a Sub Sector: one tidy spelling per group, '' when empty. */
export function subSectorName(sector: string | null | undefined, sub: string | null | undefined): string {
  const key = subSectorKey(sector, sub)
  return SUB_SECTOR_LABELS[key] ?? key.replace(/(^| )[a-z]/g, (c) => c.toUpperCase())
}

export interface SectorRow {
  id: string
  sector_command: string | null
  sub_sector: string | null
}

export interface SectorGroup<T extends SectorRow> {
  groupKey: string          // `${sectorKey}|${subKey}`
  sectorCommand: string     // display spelling (most common)
  subSector: string
  assigned: boolean         // false when either field is empty → cannot be batched
  rows: T[]
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] ?? ''
}

export function makeGroupKey(sector: string | null | undefined, sub: string | null | undefined): string {
  return `${sectorCommandKey(sector)}|${subSectorKey(sector, sub)}`
}

/** Group rows by (sector, sub sector), merging spelling variants. */
export function groupBySector<T extends SectorRow>(rows: T[]): SectorGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = makeGroupKey(r.sector_command, r.sub_sector)
    const list = map.get(k) ?? []
    list.push(r)
    map.set(k, list)
  }
  const groups: SectorGroup<T>[] = []
  for (const [groupKey, list] of map) {
    const [sc, ss] = groupKey.split('|')
    groups.push({
      groupKey,
      sectorCommand: mostCommon(list.map((r) => sectorCommandName(r.sector_command)).filter(Boolean)) || 'Unassigned',
      subSector: subSectorName(list[0].sector_command, list[0].sub_sector) || 'Unassigned',
      assigned: !!sc && !!ss,
      rows: list,
    })
  }
  return groups.sort(
    (a, b) =>
      Number(b.assigned) - Number(a.assigned) ||
      a.sectorCommand.localeCompare(b.sectorCommand) ||
      a.subSector.localeCompare(b.subSector)
  )
}
