'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SectorSelects from '@/components/dashboards/SectorSelects'
import type { SectorOption } from '@/lib/sector-options'
import { CJTF_RANKS, DEFAULT_RECOMMENDED_RANK } from '@/lib/ranks'
import { sectorCommandKey, sectorKey } from '@/lib/sectors'

const MAX_BATCH = 200

export interface ScreeningRow {
  id: string
  name: string
  address: string | null
  sectorCommand: string | null
  subSector: string | null
  verifiedOn: string
}

export default function ScreeningQueue({ rows, sectors }: { rows: ScreeningRow[]; sectors: SectorOption[] }) {
  const router = useRouter()
  const [sector, setSector] = useState('')
  const [sub, setSub] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchRank, setBatchRank] = useState<string>(DEFAULT_RECOMMENDED_RANK)
  const [ownRank, setOwnRank] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (sector && sectorCommandKey(r.sectorCommand) !== sector) return false
      if (sub && sectorKey(r.subSector) !== sub) return false
      return !q || r.name.toLowerCase().includes(q)
    })
  }, [rows, sector, sub, search])

  // Only what is on screen can be sent.
  const chosen = shown.filter((r) => selected.has(r.id))
  const selectable = shown.slice(0, MAX_BATCH)
  const allChosen = selectable.length > 0 && selectable.every((r) => selected.has(r.id))
  const sectorName = sectors.find((s) => s.key === sector)?.name ?? ''

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function send() {
    if (!note.trim()) { toast.error('Write a screening note for this batch.'); return }
    if (chosen.length > MAX_BATCH) { toast.error(`Select at most ${MAX_BATCH} at a time.`); return }
    if (!confirm(`Clear ${chosen.length} applicant(s) from ${sectorName} and send them to Admin?`)) return
    setSending(true)
    try {
      const res = await fetch('/api/screening-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, items: chosen.map((r) => ({ id: r.id, rank: ownRank[r.id] ?? batchRank })) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(json.error ?? 'Could not send this batch.')
      else {
        toast.success(`${json.sent} applicant(s) sent to Admin.${json.skipped ? ` ${json.skipped} skipped.` : ''}`)
        if (json.warning) toast.error(json.warning)
        setSelected(new Set())
        setOwnRank({})
        setNote('')
      }
      router.refresh()
    } catch {
      toast.error('Network error. Refresh to see what was sent before trying again.')
    }
    setSending(false)
  }

  function clearSelection() {
    setSelected(new Set())
    setOwnRank({})
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Applications for Screening</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <SectorSelects
            options={sectors} sector={sector} sub={sub} countLabel="waiting"
            onSector={(k) => { setSector(k); setSub(''); clearSelection() }}
            onSub={(k) => { setSub(k); clearSelection() }}
          />
          <label className="text-xs text-gray-500 space-y-1 flex-1 min-w-[180px]">
            <span className="block">Search name</span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full border rounded px-3 py-2 text-sm" />
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Showing {shown.length} of {rows.length}.{' '}
          {sector ? 'Tick applicants to send them to Admin as one batch.' : 'Pick a Sector Command to select applicants and send them as a batch.'}
        </p>

        {chosen.length > 0 && (
          <div className="rounded border border-purple-200 bg-purple-50 p-3 space-y-3">
            <p className="text-sm font-medium text-purple-900">{chosen.length} selected from {sectorName}</p>
            <label className="text-xs text-gray-600 space-y-1 block sm:w-64">
              <span className="block">Recommended rank for this batch</span>
              <select value={batchRank} onChange={(e) => setBatchRank(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white">
                {CJTF_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2}
              placeholder="Screening note for this batch (required)"
              className="w-full border rounded px-3 py-2 text-sm bg-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={send} disabled={sending || !note.trim()} className="bg-cjtf-green hover:bg-cjtf-green-dark">
                {sending ? 'Sending…' : `Send ${chosen.length} to Admin`}
              </Button>
              <Button variant="outline" onClick={clearSelection} disabled={sending}>Clear selection</Button>
            </div>
            <p className="text-xs text-gray-500">You can change one person&apos;s rank in the Rank column below.</p>
          </div>
        )}

        {sector && shown.length > MAX_BATCH && (
          <p className="text-xs text-amber-700">A batch holds {MAX_BATCH}. “Select all” picks the first {MAX_BATCH}.</p>
        )}

        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No applications pending screening here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-xs uppercase">
                  <th className="w-8 pb-2 pr-2 text-left">
                    {sector && (
                      <input
                        type="checkbox" aria-label="Select all shown applicants" checked={allChosen}
                        onChange={() => (allChosen ? clearSelection() : setSelected(new Set(selectable.map((r) => r.id))))}
                      />
                    )}
                  </th>
                  <th className="text-left pb-2 pr-4">Name</th>
                  {chosen.length > 0 && <th className="text-left pb-2 pr-4">Rank</th>}
                  <th className="text-left pb-2 pr-4">Address</th>
                  <th className="text-left pb-2 pr-4">Sector Command</th>
                  <th className="text-left pb-2 pr-4">Sub Sector</th>
                  <th className="text-left pb-2 pr-4">ICT Verified</th>
                  <th className="text-left pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-2">
                      <input type="checkbox" disabled={!sector} checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                    </td>
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    {chosen.length > 0 && (
                      <td className="py-2 pr-4">
                        {selected.has(r.id) && (
                          <select
                            aria-label={`Rank for ${r.name}`} value={ownRank[r.id] ?? batchRank}
                            onChange={(e) => setOwnRank((o) => ({ ...o, [r.id]: e.target.value }))}
                            className="border rounded px-2 py-1 text-xs bg-white"
                          >
                            {CJTF_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                          </select>
                        )}
                      </td>
                    )}
                    <td className="py-2 pr-4 text-gray-600">{r.address || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.sectorCommand || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.subSector || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500">{r.verifiedOn}</td>
                    <td className="py-2">
                      <LinkButton href={`/portal/int/application/${r.id}`} size="sm" variant="outline" className="text-xs border-purple-600 text-purple-700 hover:bg-purple-50">
                        Screen Application
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
