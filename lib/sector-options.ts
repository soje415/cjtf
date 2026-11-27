// Dropdown options for the Sector Command → Sub Sector filters: EVERY sector on
// record, each with how many rows of the current queue sit in it (may be 0).
import { normalizeSectorName, sectorCommandKey, sectorCommandName, sectorKey } from '@/lib/sectors'

export interface SectorPair {
  sector_command: string | null
  sub_sector: string | null
}

export interface SubSectorOption { key: string; name: string; count: number }
export interface SectorOption { key: string; name: string; count: number; subs: SubSectorOption[] }

export function buildSectorOptions(everyone: SectorPair[], queue: SectorPair[]): SectorOption[] {
  // key → spelling → times seen
  type Names = Map<string, number>
  const sectors = new Map<string, { names: Names; count: number; subs: Map<string, { names: Names; count: number }> }>()

  const add = (row: SectorPair, queued: number, seen: number) => {
    const sk = sectorCommandKey(row.sector_command)
    if (!sk) return
    const sector = sectors.get(sk) ?? { names: new Map(), count: 0, subs: new Map() }
    sectors.set(sk, sector)
    sector.count += queued
    const sName = sectorCommandName(row.sector_command)
    sector.names.set(sName, (sector.names.get(sName) ?? 0) + seen)
    const uk = sectorKey(row.sub_sector)
    if (!uk) return
    const sub = sector.subs.get(uk) ?? { names: new Map(), count: 0 }
    sector.subs.set(uk, sub)
    sub.count += queued
    const uName = normalizeSectorName(row.sub_sector)
    sub.names.set(uName, (sub.names.get(uName) ?? 0) + seen)
  }
  for (const row of everyone) add(row, 0, 1)
  for (const row of queue) add(row, 1, 0)

  const best = (names: Names) => Array.from(names.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en', { numeric: true })

  return Array.from(sectors.entries())
    .map(([key, s]) => ({
      key,
      name: best(s.names),
      count: s.count,
      subs: Array.from(s.subs.entries()).map(([k, u]) => ({ key: k, name: best(u.names), count: u.count })).sort(byName),
    }))
    .sort(byName)
}
