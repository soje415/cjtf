'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { normalizeSectorName, sectorKey } from '@/lib/sectors'
import SectorSelects from '@/components/dashboards/SectorSelects'
import type { SectorOption } from '@/lib/sector-options'

export interface QueueRow {
  id: string
  name: string
  cjtfId: string | null
  unit: string | null
  /** true when the ID card has already been generated (legacy / carded applicants) */
  carded: boolean
}

export interface QueueGroup {
  groupKey: string
  sectorCommand: string
  subSector: string
  assigned: boolean
  rows: QueueRow[]
}

const ALL = ''

export default function PrintQueueClient({ groups, sectors, role }: { groups: QueueGroup[]; sectors: SectorOption[]; role: 'int' | 'admin' }) {
  const router = useRouter()
  // selected ids per group
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)

  // ── filters: Sector → Sub Sector → Unit, plus a name / ID search ────────
  const [sector, setSector] = useState(ALL)
  const [sub, setSub] = useState(ALL)
  const [unit, setUnit] = useState(ALL)
  const [search, setSearch] = useState('')

  // Units narrow to the chosen sector / sub sector. Spelling variants merge by key.
  const unitOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) {
      const [sectorPart, subPart] = g.groupKey.split('|')
      if (sector && sectorPart !== sector) continue
      if (sub && subPart !== sub) continue
      for (const r of g.rows) {
        const k = sectorKey(r.unit)
        if (k && !m.has(k)) m.set(k, normalizeSectorName(r.unit))
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [groups, sector, sub])

  // Apply the filters. A group survives only with rows left in it.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out: QueueGroup[] = []
    for (const g of groups) {
      const [sectorPart, subPart] = g.groupKey.split('|')
      if (sector && sectorPart !== sector) continue
      if (sub && subPart !== sub) continue
      const rows = g.rows.filter((r) => {
        if (unit && sectorKey(r.unit) !== unit) return false
        if (q && !r.name.toLowerCase().includes(q) && !(r.cjtfId ?? '').toLowerCase().includes(q)) return false
        return true
      })
      if (rows.length) out.push({ ...g, rows })
    }
    return out
  }, [groups, sector, sub, unit, search])

  const filtering = !!(sector || sub || unit || search.trim())
  const totalShown = filtered.reduce((n, g) => n + g.rows.length, 0)

  // Group by sector command for a two-level display.
  const bySector = useMemo(() => {
    const m = new Map<string, QueueGroup[]>()
    for (const g of filtered) {
      const list = m.get(g.sectorCommand) ?? []
      list.push(g)
      m.set(g.sectorCommand, list)
    }
    return [...m.entries()]
  }, [filtered])

  function toggle(groupKey: string, id: string) {
    setSelected((s) => {
      const next = new Set(s[groupKey] ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...s, [groupKey]: next }
    })
  }

  // "Select all" acts on the rows the filters currently show.
  function toggleAll(g: QueueGroup) {
    const visible = g.rows.map((r) => r.id)
    setSelected((s) => {
      const cur = new Set(s[g.groupKey] ?? [])
      const all = visible.every((id) => cur.has(id))
      for (const id of visible) {
        if (all) cur.delete(id)
        else cur.add(id)
      }
      return { ...s, [g.groupKey]: cur }
    })
  }

  async function send(g: QueueGroup) {
    // Only ids still visible under the current filters are sent.
    const visible = new Set(g.rows.map((r) => r.id))
    const ids = [...(selected[g.groupKey] ?? [])].filter((id) => visible.has(id))
    if (ids.length === 0) return
    setSending(g.groupKey)
    try {
      const res = await fetch('/api/print-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupKey: g.groupKey, applicationIds: ids, note: notes[g.groupKey] ?? '' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Could not send this batch.')
        router.refresh()
      } else {
        toast.success(`${ids.length} applicant(s) sent to ${role === 'int' ? 'Admin' : 'ICT'} — batch ${json.batch?.batch_no ?? ''}`)
        setSelected((s) => ({ ...s, [g.groupKey]: new Set() }))
        router.refresh()
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setSending(null)
  }

  const selectCls = 'border rounded px-3 py-1.5 text-sm bg-white min-w-[160px]'

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <SectorSelects
              options={sectors} sector={sector} sub={sub} countLabel="ready"
              onSector={(k) => { setSector(k); setSub(ALL); setUnit(ALL) }}
              onSub={(k) => { setSub(k); setUnit(ALL) }}
            />
            <label className="text-xs text-gray-500 space-y-1">
              <span className="block">Unit</span>
              <select className={selectCls} value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value={ALL}>All units</option>
                {unitOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 space-y-1 flex-1 min-w-[180px]">
              <span className="block">Search name or CJTF ID</span>
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </label>
            {filtering && (
              <Button variant="outline" size="sm" onClick={() => { setSector(ALL); setSub(ALL); setUnit(ALL); setSearch('') }}>
                Clear filters
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {totalShown} applicant(s) in {filtered.length} group(s){filtering ? ' match your filters' : ''}.
            A batch holds one Sector and Sub Sector; the Unit filter narrows who goes in it.
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            {groups.length === 0 ? 'No approved applicants are waiting to be batched.' : 'No approved applicants are ready under these filters.'}
          </CardContent>
        </Card>
      )}

      {bySector.map(([sectorName, subs]) => (
        <div key={sectorName} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {sectorName} <span className="font-normal normal-case text-gray-400">· {subs.reduce((n, g) => n + g.rows.length, 0)} applicant(s)</span>
          </h2>
          {subs.map((g) => {
            const sel = selected[g.groupKey] ?? new Set<string>()
            const selVisible = g.rows.filter((r) => sel.has(r.id)).length
            // A filtered view auto-expands; otherwise it's click-to-review.
            const isOpen = open[g.groupKey] ?? filtering
            const awaitingId = g.rows.filter((r) => !r.carded).length
            return (
              <Card key={g.groupKey}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{g.subSector}</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {g.rows.length} applicant(s) · {awaitingId} awaiting ID generation
                        {g.rows.length - awaitingId > 0 && ` · ${g.rows.length - awaitingId} card already generated`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!g.assigned && <Badge className="bg-red-100 text-red-700">Sector missing</Badge>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen((o) => ({ ...o, [g.groupKey]: !isOpen }))}
                      >
                        {isOpen ? 'Hide applicants' : 'Review applicants'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-3">
                    {!g.assigned && (
                      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        These applicants have no Sector Command or Sub Sector on record, so they can&apos;t be batched.
                        Open each record and correct the posting first.
                      </p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-gray-500 text-xs uppercase">
                            <th className="w-8 pb-2 text-left">
                              {g.assigned && (
                                <input
                                  type="checkbox"
                                  aria-label="Select all shown applicants"
                                  checked={g.rows.length > 0 && g.rows.every((r) => sel.has(r.id))}
                                  onChange={() => toggleAll(g)}
                                />
                              )}
                            </th>
                            <th className="text-left pb-2 pr-4">Name</th>
                            <th className="text-left pb-2 pr-4">CJTF ID</th>
                            <th className="text-left pb-2 pr-4">Unit</th>
                            <th className="text-left pb-2">ID card</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((r) => (
                            <tr key={r.id} className="border-b last:border-0">
                              <td className="py-1.5">
                                <input
                                  type="checkbox"
                                  disabled={!g.assigned}
                                  checked={sel.has(r.id)}
                                  onChange={() => toggle(g.groupKey, r.id)}
                                  aria-label={`Select ${r.name}`}
                                />
                              </td>
                              <td className="py-1.5 pr-4 font-medium">{r.name}</td>
                              <td className="py-1.5 pr-4 text-gray-600">{r.cjtfId ?? '—'}</td>
                              <td className="py-1.5 pr-4 text-gray-600">{normalizeSectorName(r.unit) || '—'}</td>
                              <td className="py-1.5">
                                {r.carded
                                  ? <span className="text-xs text-green-700">Generated</span>
                                  : <span className="text-xs text-amber-700">Awaiting generation</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {g.assigned && (
                      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                        <input
                          type="text"
                          value={notes[g.groupKey] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [g.groupKey]: e.target.value }))}
                          placeholder={`Note for ${role === 'int' ? 'Admin' : 'ICT'} (optional)`}
                          maxLength={500}
                          className="flex-1 min-w-[200px] border rounded px-3 py-1.5 text-sm"
                        />
                        <Button
                          onClick={() => send(g)}
                          disabled={selVisible === 0 || sending === g.groupKey}
                          className="bg-cjtf-green hover:bg-cjtf-green-dark"
                        >
                          {sending === g.groupKey ? 'Sending…' : `Send ${selVisible} to ${role === 'int' ? 'Admin' : 'ICT'}`}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      ))}
    </div>
  )
}
