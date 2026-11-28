'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Filter, ListChecks, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, Panel, Pill, field, fieldLabel, headRow, rowButton, table, td, th, tr } from '@/components/dashboards/StaffUI'
import type { SectorOption } from '@/lib/sector-options'
import { sectorCommandKey, sectorCommandName, subSectorKey, subSectorName } from '@/lib/sectors'
import { CJTF_RANKS } from '@/lib/ranks'
import { MEMBERSHIP_TYPE_LABELS, MembershipType } from '@/lib/types'

const MAX_BATCH = 200

export interface PendingRow {
  id: string
  name: string
  address: string | null
  sectorCommand: string | null
  subSector: string | null
  membershipType: MembershipType
  /** the rank the single-review screen would open on */
  suggestedRank: string
  /** true when suggestedRank is only the applicant's own claim */
  selfReported: boolean
  clearedOn: string
  /** shared by everyone INT sent together; null when sent individually */
  batchKey: string | null
}

export interface PendingBatch { key: string; label: string }

export default function AdminPendingQueue({ rows, sectors, batches }: { rows: PendingRow[]; sectors: SectorOption[]; batches: PendingBatch[] }) {
  const [pickedSector, setSector] = useState('')
  const [pickedSub, setSub] = useState('')
  const [pickedBatch, setBatch] = useState('')
  // A choice stops applying once nobody is left under it (after approving, say),
  // so the list never filters on something the dropdowns no longer show.
  const current = sectors.find((s) => s.key === pickedSector)
  const subs = current?.subs ?? []
  const sector = current ? pickedSector : ''
  const sub = subs.some((s) => s.key === pickedSub) ? pickedSub : ''
  const batch = batches.some((b) => b.key === pickedBatch) ? pickedBatch : ''
  // a typed name waits for Search / Enter; the dropdowns filter at once
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // '' = each person keeps their suggested rank
  const [batchRank, setBatchRank] = useState('')
  const [ownRank, setOwnRank] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!batch || r.batchKey === batch) &&
        (!sector || sectorCommandKey(r.sectorCommand) === sector) &&
        (!sub || subSectorKey(r.sectorCommand, r.subSector) === sub) &&
        (!q || r.name.toLowerCase().includes(q))
    )
  }, [rows, sector, sub, batch, query])

  // Only what is on screen can be approved.
  const canSelect = !!(sector || batch)
  const chosen = shown.filter((r) => selected.has(r.id))
  const selectable = shown.slice(0, MAX_BATCH)
  const allChosen = selectable.length > 0 && selectable.every((r) => selected.has(r.id))
  const rankFor = (r: PendingRow) => ownRank[r.id] ?? (batchRank || r.suggestedRank)
  const selfRanked = chosen.filter((r) => r.selfReported && !batchRank && !ownRank[r.id]).length

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
    setBatchRank('')
  }

  async function approve() {
    if (!note.trim()) { toast.error('Write a decision note for these approvals.'); return }
    if (chosen.length > MAX_BATCH) { toast.error(`Select at most ${MAX_BATCH} at a time.`); return }
    if (!confirm(`Approve ${chosen.length} applicant(s) and send them to training? Each one gets the rank shown and a text message.`)) return
    setSending(true)
    try {
      const res = await fetch('/api/approval-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, items: chosen.map((r) => ({ id: r.id, rank: rankFor(r) })) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(json.error ?? 'Could not approve these applicants.')
      else {
        toast.success(`${json.approved} applicant(s) approved and sent to training.${json.skipped ? ` ${json.skipped} skipped.` : ''}`)
        if (json.warning) toast.error(json.warning)
        clearSelection()
        setNote('')
      }
      router.refresh()
    } catch {
      toast.error('Network error. Refresh to see what was approved before trying again.')
    }
    setSending(false)
  }

  return (
    <div className="space-y-5">
      <Panel title="Filter Applications" icon={Filter}>
        <form
          className="grid grid-cols-1 items-end gap-3 p-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
          onSubmit={(e) => { e.preventDefault(); setQuery(name); clearSelection() }}
        >
          <label className={fieldLabel}>
            <span>Sector</span>
            <select className={field} value={sector} onChange={(e) => { setSector(e.target.value); setSub(''); setBatch(''); clearSelection() }}>
              <option value="">All sectors</option>
              {sectors.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.count})</option>)}
            </select>
          </label>
          <label className={fieldLabel}>
            <span>Sub-Sector</span>
            <select className={field} value={sub} disabled={!sector} onChange={(e) => { setSub(e.target.value); setBatch(''); clearSelection() }}>
              <option value="">{sector ? 'All sub-sectors' : 'Pick a sector first'}</option>
              {subs.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.count})</option>)}
            </select>
          </label>
          <label className={fieldLabel}>
            <span>Batch from INT</span>
            <select className={field} value={batch} disabled={!batches.length} onChange={(e) => { setBatch(e.target.value); setSector(''); setSub(''); clearSelection() }}>
              <option value="">{batches.length ? 'All batches' : 'No batches waiting'}</option>
              {batches.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </label>
          <label className={fieldLabel}>
            <span>Name</span>
            <input type="text" className={field} value={name} placeholder="Any name" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" className="h-[38px] flex-1 gap-2 bg-blue-600 text-white hover:bg-blue-700">
              <Search className="h-4 w-4" /> Search
            </Button>
            <Button
              type="button" variant="outline" className="h-[38px]"
              onClick={() => { setSector(''); setSub(''); setBatch(''); setName(''); setQuery(''); clearSelection() }}
            >
              Clear
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Sent by Intelligence" icon={ListChecks}
        aside={<>Showing {shown.length} of {rows.length}. {canSelect ? 'Tick applicants to approve them together.' : 'Pick a Sector or a batch to approve several at once.'}</>}
      >
        <div className="space-y-4">
          {chosen.length > 0 && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">{chosen.length} selected</p>
              <label className="block space-y-1 text-xs text-slate-600 sm:w-80">
                <span className="block">Rank to assign</span>
                <select value={batchRank} onChange={(e) => { setBatchRank(e.target.value); setOwnRank({}) }} className={field}>
                  <option value="">Keep each person&apos;s suggested rank</option>
                  {CJTF_RANKS.map((r) => <option key={r} value={r}>{r} for everyone selected</option>)}
                </select>
              </label>
              {selfRanked > 0 && (
                <p className="text-xs text-red-700">
                  {selfRanked} selected would get a rank they reported themselves. Check the Rank column before approving.
                </p>
              )}
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2}
                placeholder="Decision note for these approvals (required)" className={field}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={approve} disabled={sending || !note.trim()} className="bg-green-600 text-white hover:bg-green-700">
                  {sending ? 'Approving…' : `Approve ${chosen.length} & send to training`}
                </Button>
                <Button variant="outline" onClick={clearSelection} disabled={sending}>Clear selection</Button>
              </div>
              <p className="text-xs text-slate-500">To reject someone, open them with Review.</p>
            </div>
          )}

          {canSelect && shown.length > MAX_BATCH && (
            <p className="text-xs text-amber-700">You can approve {MAX_BATCH} at a time. “Select all” picks the first {MAX_BATCH}.</p>
          )}

          {shown.length === 0 ? (
            <Empty>{rows.length ? 'No applications match these filters.' : 'Nothing waiting. Applicants appear here once Intelligence sends them.'}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr className={headRow}>
                    <th className={`${th} w-8`}>
                      {canSelect && (
                        <input
                          type="checkbox" aria-label="Select all shown applicants" checked={allChosen}
                          onChange={() => (allChosen ? clearSelection() : setSelected(new Set(selectable.map((r) => r.id))))}
                        />
                      )}
                    </th>
                    <th className={th}>S/N</th>
                    <th className={th}>Name</th>
                    <th className={th}>Sector</th>
                    <th className={th}>Sub-Sector</th>
                    <th className={th}>Rank</th>
                    <th className={th}>Status</th>
                    <th className={th}>INT Cleared</th>
                    <th className={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={r.id} className={tr}>
                      <td className={td}>
                        <input type="checkbox" disabled={!canSelect} checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                      </td>
                      <td className={`${td} text-slate-500`}>{i + 1}</td>
                      <td className={td}>
                        <p className="font-semibold text-slate-900">{r.name}</p>
                        <p className="text-xs text-slate-500">
                          {MEMBERSHIP_TYPE_LABELS[r.membershipType]}{r.address ? ` · ${r.address}` : ''}
                        </p>
                      </td>
                      <td className={td}>{sectorCommandName(r.sectorCommand) || '—'}</td>
                      <td className={td}>{subSectorName(r.sectorCommand, r.subSector) || '—'}</td>
                      <td className={td}>
                        {selected.has(r.id) && canSelect ? (
                          <select
                            aria-label={`Rank for ${r.name}`} value={rankFor(r)}
                            onChange={(e) => setOwnRank((o) => ({ ...o, [r.id]: e.target.value }))}
                            className="w-28 rounded border border-slate-300 bg-white px-1 py-1 text-xs"
                          >
                            {CJTF_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                          </select>
                        ) : (
                          r.suggestedRank
                        )}
                        {r.selfReported && !batchRank && !ownRank[r.id] && <span className="block text-xs text-red-700">self-reported</span>}
                      </td>
                      <td className={td}><Pill tone="amber">Pending</Pill></td>
                      <td className={`${td} whitespace-nowrap`}>{r.clearedOn}</td>
                      <td className={td}><Link href={`/portal/admin/application/${r.id}`} className={rowButton}>Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
