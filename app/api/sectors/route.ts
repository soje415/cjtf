import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizeSectorName, sectorKey, subSectorKey, subSectorName } from '@/lib/sectors'

// GET: suggestions for the Sector Command / Sub Sector inputs — the distinct,
// tidied values already in use, so new applicants pick an existing spelling
// instead of inventing a variant. Names only; no personal data.
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data } = await service
    .from('applications')
    .select('sector_command, sub_sector')
    .not('sector_command', 'is', null)
    .not('sub_sector', 'is', null)
    .limit(5000)

  // canonical spelling per key = most common normalised form
  const tally = (m: Map<string, Map<string, number>>, key: string, name: string) => {
    if (!key || !name) return
    const inner = m.get(key) ?? new Map<string, number>()
    inner.set(name, (inner.get(name) ?? 0) + 1)
    m.set(key, inner)
  }
  const pickBest = (inner: Map<string, number>) => [...inner.entries()].sort((a, b) => b[1] - a[1])[0][0]

  const sectors = new Map<string, Map<string, number>>()
  const subsBySector = new Map<string, Map<string, Map<string, number>>>()
  for (const r of data ?? []) {
    const sk = sectorKey(r.sector_command)
    const uk = subSectorKey(r.sector_command, r.sub_sector)
    if (!sk || !uk) continue
    tally(sectors, sk, normalizeSectorName(r.sector_command))
    const subs = subsBySector.get(sk) ?? new Map<string, Map<string, number>>()
    tally(subs, uk, subSectorName(r.sector_command, r.sub_sector))
    subsBySector.set(sk, subs)
  }

  const out = [...sectors.entries()]
    .map(([sk, inner]) => ({
      name: pickBest(inner),
      subs: [...(subsBySector.get(sk)?.values() ?? [])].map(pickBest).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ sectors: out })
}
