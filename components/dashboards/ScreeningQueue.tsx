'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Filter, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { SectorOption } from '@/lib/sector-options'
import { CJTF_RANKS, DEFAULT_RECOMMENDED_RANK } from '@/lib/ranks'
import { normalizeSectorName, sectorCommandKey, sectorCommandName, sectorKey } from '@/lib/sectors'

const MAX_BATCH = 200

export interface ScreeningRow {
  id: string
  name: string
  state: string | null
  sectorCommand: string | null
  subSector: string | null
  unit: string | null
  /** the rank an existing member already holds; null when one has to be chosen */
  heldRank: string | null
  isLegacy: boolean
  date: string
}

const NO_FILTERS = { state: '', sector: '', sub: '', unit: '', name: '' }
type Filters = typeof NO_FILTERS

const stateKey = (s: string | null) => (s ?? '').trim().toLowerCase()

/** key → label for the values present in `rows`, sorted by label. */
function choices(rows: ScreeningRow[], key: (r: ScreeningRow) => string, label: (r: ScreeningRow) => string) {
  const m = new Map<string, string>()
  for (const r of rows) {
    const k = key(r)
    if (k && !m.has(k)) m.set(k, label(r))
  }
  return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], 'en', { numeric: true }))
}

export default function ScreeningQueue({ rows, sectors }: { rows: ScreeningRow[]; sectors: SectorOption[] }) {
  const router = useRouter()
  // Dropdowns filter as soon as they change; a typed name waits for Search / Enter.
  const [applied, setApplied] = useState<Filters>(NO_FILTERS)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newRank, setNewRank] = useState<string>(DEFAULT_RECOMMENDED_RANK)
  const [ownRank, setOwnRank] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const states = useMemo(() => choices(rows, (r) => stateKey(r.state), (r) => (r.state ?? '').trim()), [rows])
  const subs = sectors.find((s) => s.key === applied.sector)?.subs ?? []
  const units = useMemo(
    () =>
      choices(
        rows.filter(
          (r) =>
            (!applied.sector || sectorCommandKey(r.sectorCommand) === applied.sector) &&
            (!applied.sub || sectorKey(r.subSector) === applied.sub)
        ),
        (r) => sectorKey(r.unit),
        (r) => normalizeSectorName(r.unit)
      ),
    [rows, applied.sector, applied.sub]
  )

  const shown = useMemo(() => {
    const q = applied.name.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!applied.state || stateKey(r.state) === applied.state) &&
        (!applied.sector || sectorCommandKey(r.sectorCommand) === applied.sector) &&
        (!applied.sub || sectorKey(r.subSector) === applied.sub) &&
        (!applied.unit || sectorKey(r.unit) === applied.unit) &&
        (!q || r.name.toLowerCase().includes(q))
    )
  }, [rows, applied])

  // Only what is on screen can be sent.
  const chosen = shown.filter((r) => selected.has(r.id))
  const selectable = shown.slice(0, MAX_BATCH)
  const allChosen = selectable.length > 0 && selectable.every((r) => selected.has(r.id))
  const sectorName = sectors.find((s) => s.key === applied.sector)?.name ?? ''
  const rankFor = (r: ScreeningRow) => ownRank[r.id] ?? r.heldRank ?? newRank
  const needRank = chosen.filter((r) => !r.heldRank)
  const rankTotals = CJTF_RANKS.map((rank) => [rank, chosen.filter((r) => rankFor(r) === rank).length] as const)
    .filter(([, n]) => n > 0)
    .map(([rank, n]) => `${rank}: ${n}`)
    .join(' · ')

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
    setOwnRank({})
  }

  // Changing what is shown drops the ticks, so nobody hidden gets sent.
  function filterBy(change: Partial<Filters>) {
    setApplied((f) => ({ ...f, ...change }))
    clearSelection()
  }

  async function send() {
    if (!note.trim()) { toast.error('Write a screening note for this batch.'); return }
    if (chosen.length > MAX_BATCH) { toast.error(`Select at most ${MAX_BATCH} at a time.`); return }
    if (!confirm(`Clear ${chosen.length} applicant(s) from ${sectorName} and send them to Admin?\n\nRanks — ${rankTotals}`)) return
    setSending(true)
    try {
      const res = await fetch('/api/screening-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, items: chosen.map((r) => ({ id: r.id, rank: rankFor(r) })) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(json.error ?? 'Could not send this batch.')
      else {
        toast.success(`${json.sent} applicant(s) sent to Admin.${json.skipped ? ` ${json.skipped} skipped.` : ''}`)
        if (json.warning) toast.error(json.warning)
        clearSelection()
        setNote('')
      }
      router.refresh()
    } catch {
      toast.error('Network error. Refresh to see what was sent before trying again.')
    }
    setSending(false)
  }

  const field = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400'
  const label = 'block space-y-1 text-sm font-medium text-slate-700'
  const th = 'px-2 py-2.5 text-left font-semibold'
  const td = 'px-2 py-2'

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-white">
        <h2 className="flex items-center gap-2 rounded-t-xl border-b bg-slate-50 px-5 py-3 text-lg font-bold text-slate-900">
          <Filter className="h-5 w-5 fill-current" /> Screen Applicants
        </h2>
        <form
          className="grid grid-cols-1 items-end gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
          onSubmit={(e) => { e.preventDefault(); filterBy({ name }) }}
        >
          <label className={label}>
            <span>State</span>
            <select className={field} value={applied.state} onChange={(e) => filterBy({ state: e.target.value })}>
              <option value="">All states</option>
              {states.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={label}>
            <span>Sector</span>
            <select className={field} value={applied.sector} onChange={(e) => filterBy({ sector: e.target.value, sub: '', unit: '' })}>
              <option value="">All sectors</option>
              {sectors.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.count})</option>)}
            </select>
          </label>
          <label className={label}>
            <span>Sub-Sector</span>
            <select className={field} value={applied.sub} disabled={!applied.sector} onChange={(e) => filterBy({ sub: e.target.value, unit: '' })}>
              <option value="">{applied.sector ? 'All sub-sectors' : 'Pick a sector first'}</option>
              {subs.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.count})</option>)}
            </select>
          </label>
          <label className={label}>
            <span>Unit/Office</span>
            <select className={field} value={applied.unit} disabled={units.length === 0} onChange={(e) => filterBy({ unit: e.target.value })}>
              <option value="">{units.length ? 'All units' : 'No units recorded'}</option>
              {units.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={label}>
            <span>Name</span>
            <input type="text" className={field} value={name} placeholder="Any name" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" className="h-[38px] flex-1 gap-2 bg-blue-600 text-white hover:bg-blue-700">
              <Search className="h-4 w-4" /> Search
            </Button>
            <Button type="button" variant="outline" className="h-[38px]" onClick={() => { setName(''); filterBy(NO_FILTERS) }}>Clear</Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-t-xl border-b bg-slate-50 px-5 py-3">
          <h2 className="text-lg font-bold text-slate-900">Applications List</h2>
          <p className="text-xs text-slate-500">
            Showing {shown.length} of {rows.length}.{' '}
            {applied.sector ? 'Tick applicants to send them to Admin as one batch.' : 'Pick a Sector to tick applicants and send them as a batch.'}
          </p>
        </div>

        <div className="space-y-4 p-3">
          {chosen.length > 0 && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div>
                <p className="text-sm font-semibold text-blue-900">{chosen.length} selected from {sectorName}</p>
                <p className="text-xs text-slate-700">Ranks to be sent — {rankTotals}</p>
                <p className="text-xs text-slate-500">Existing members keep the rank on their record. Change one person in the Rank column.</p>
              </div>
              {needRank.length > 0 && (
                <label className="block space-y-1 text-xs text-slate-600 sm:w-72">
                  <span className="block">Rank for the {needRank.length} without one (new members)</span>
                  <select value={newRank} onChange={(e) => setNewRank(e.target.value)} className={field}>
                    {CJTF_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              )}
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2}
                placeholder="Screening note for this batch (required)" className={field}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={send} disabled={sending || !note.trim()} className="bg-blue-600 text-white hover:bg-blue-700">
                  {sending ? 'Sending…' : `Send ${chosen.length} to Admin`}
                </Button>
                <Button variant="outline" onClick={clearSelection} disabled={sending}>Clear selection</Button>
              </div>
            </div>
          )}

          {applied.sector && shown.length > MAX_BATCH && (
            <p className="text-xs text-amber-700">A batch holds {MAX_BATCH}. “Select all” picks the first {MAX_BATCH}.</p>
          )}

          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No applications pending screening here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#0b357f] text-white">
                    <th className={`${th} w-8 rounded-l-md`}>
                      {applied.sector && (
                        <input
                          type="checkbox" aria-label="Select all shown applicants" checked={allChosen}
                          onChange={() => (allChosen ? clearSelection() : setSelected(new Set(selectable.map((r) => r.id))))}
                        />
                      )}
                    </th>
                    <th className={th}>S/N</th>
                    <th className={th}>Name</th>
                    <th className={th}>State</th>
                    <th className={th}>Sector</th>
                    <th className={th}>Sub-Sector</th>
                    <th className={th}>Unit/Office</th>
                    <th className={th}>Rank</th>
                    <th className={th}>Status</th>
                    <th className={th}>Date</th>
                    <th className={`${th} rounded-r-md`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className={td}>
                        <input type="checkbox" disabled={!applied.sector} checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                      </td>
                      <td className={`${td} text-slate-500`}>{i + 1}</td>
                      <td className={`${td} font-medium text-slate-900`}>{r.name}</td>
                      <td className={td}>{r.state || '—'}</td>
                      <td className={td}>{sectorCommandName(r.sectorCommand) || '—'}</td>
                      <td className={td}>{normalizeSectorName(r.subSector) || '—'}</td>
                      <td className={td}>{normalizeSectorName(r.unit) || '—'}</td>
                      <td className={td}>
                        {selected.has(r.id) && applied.sector ? (
                          <select
                            aria-label={`Rank for ${r.name}`} value={rankFor(r)}
                            onChange={(e) => setOwnRank((o) => ({ ...o, [r.id]: e.target.value }))}
                            className="w-28 rounded border border-slate-300 bg-white px-1 py-1 text-xs"
                          >
                            {CJTF_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                          </select>
                        ) : (
                          r.heldRank ?? <span className="text-slate-400">{r.isLegacy ? 'Not recorded' : 'New'}</span>
                        )}
                      </td>
                      <td className={td}>
                        <span className="rounded bg-amber-200 px-3 py-1 text-xs font-bold text-red-800">Pending</span>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{r.date}</td>
                      <td className={td}>
                        <Link href={`/portal/int/application/${r.id}`} className="inline-block rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
