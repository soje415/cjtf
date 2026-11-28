'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SectorSelects from '@/components/dashboards/SectorSelects'
import type { SectorOption } from '@/lib/sector-options'
import { sectorCommandKey, subSectorKey, subSectorName } from '@/lib/sectors'
import { CJTF_RANKS } from '@/lib/ranks'
import { STATUS_LABELS, STATUS_COLORS, MEMBERSHIP_TYPE_LABELS, MEMBERSHIP_TYPE_COLORS, ApplicationStatus, MembershipType } from '@/lib/types'

const MAX_BATCH = 200

export interface PendingRow {
  id: string
  name: string
  address: string | null
  sectorCommand: string | null
  subSector: string | null
  status: ApplicationStatus
  membershipType: MembershipType
  recommendedRank: string | null
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
  const [sector, setSector] = useState('')
  const [sub, setSub] = useState('')
  const [batch, setBatch] = useState('')
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // '' = each person keeps their suggested rank
  const [batchRank, setBatchRank] = useState('')
  const [ownRank, setOwnRank] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        if (batch && r.batchKey !== batch) return false
        if (sector && sectorCommandKey(r.sectorCommand) !== sector) return false
        return !sub || subSectorKey(r.sectorCommand, r.subSector) === sub
      }),
    [rows, sector, sub, batch]
  )

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
    <Card>
      <CardHeader><CardTitle className="text-base">Applications Awaiting Approval</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <SectorSelects
            options={sectors} sector={sector} sub={sub} countLabel="waiting"
            onSector={(k) => { setSector(k); setSub(''); setBatch(''); clearSelection() }}
            onSub={(k) => { setSub(k); setBatch(''); clearSelection() }}
          />
          <label className="text-xs text-gray-500 space-y-1 w-full sm:w-72">
            <span className="block">Batch from INT</span>
            <select
              className="w-full border rounded px-3 py-2 text-sm bg-white"
              value={batch}
              onChange={(e) => { setBatch(e.target.value); setSector(''); setSub(''); clearSelection() }}
            >
              <option value="">{batches.length ? 'All applications' : 'No batches waiting'}</option>
              {batches.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Showing {shown.length} of {rows.length}.{' '}
          {canSelect ? 'Tick applicants to approve them together.' : 'Pick a Sector Command or a batch from INT to approve several at once.'}
        </p>

        {chosen.length > 0 && (
          <div className="rounded border border-orange-200 bg-orange-50 p-3 space-y-3">
            <p className="text-sm font-medium text-orange-900">{chosen.length} selected</p>
            <label className="text-xs text-gray-600 space-y-1 block sm:w-72">
              <span className="block">Rank to assign</span>
              <select
                value={batchRank}
                onChange={(e) => { setBatchRank(e.target.value); setOwnRank({}) }}
                className="w-full border rounded px-3 py-2 text-sm bg-white"
              >
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
              placeholder="Decision note for these approvals (required)"
              className="w-full border rounded px-3 py-2 text-sm bg-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={approve} disabled={sending || !note.trim()} className="bg-cjtf-green hover:bg-cjtf-green-dark">
                {sending ? 'Approving…' : `Approve ${chosen.length} & send to training`}
              </Button>
              <Button variant="outline" onClick={clearSelection} disabled={sending}>Clear selection</Button>
            </div>
            <p className="text-xs text-gray-500">To reject someone, open them with Review &amp; Decide.</p>
          </div>
        )}

        {canSelect && shown.length > MAX_BATCH && (
          <p className="text-xs text-amber-700">You can approve {MAX_BATCH} at a time. “Select all” picks the first {MAX_BATCH}.</p>
        )}

        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No applications pending admin approval here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-xs uppercase">
                  <th className="w-8 pb-2 pr-2 text-left">
                    {canSelect && (
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
                  <th className="text-left pb-2 pr-4">INT rank</th>
                  <th className="text-left pb-2 pr-4">Status</th>
                  <th className="text-left pb-2 pr-4">INT Cleared</th>
                  <th className="text-left pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-2">
                      <input type="checkbox" disabled={!canSelect} checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                    </td>
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    {chosen.length > 0 && (
                      <td className="py-2 pr-4">
                        {selected.has(r.id) && (
                          <>
                            <select
                              aria-label={`Rank for ${r.name}`} value={rankFor(r)}
                              onChange={(e) => setOwnRank((o) => ({ ...o, [r.id]: e.target.value }))}
                              className="border rounded px-2 py-1 text-xs bg-white"
                            >
                              {CJTF_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                            </select>
                            {r.selfReported && !batchRank && !ownRank[r.id] && <span className="block text-xs text-red-700">self-reported</span>}
                          </>
                        )}
                      </td>
                    )}
                    <td className="py-2 pr-4 text-gray-600">{r.address || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.sectorCommand || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{subSectorName(r.sectorCommand, r.subSector) || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.recommendedRank || '—'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge className={MEMBERSHIP_TYPE_COLORS[r.membershipType]}>{MEMBERSHIP_TYPE_LABELS[r.membershipType]}</Badge>
                        <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{r.clearedOn}</td>
                    <td className="py-2">
                      <LinkButton href={`/portal/admin/application/${r.id}`} size="sm" variant="outline" className="text-xs border-orange-500 text-orange-600 hover:bg-orange-50">
                        Review &amp; Decide
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
