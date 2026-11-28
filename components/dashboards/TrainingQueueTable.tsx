'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, Panel, headRow, rowButton, table, td, th, tr } from '@/components/dashboards/StaffUI'
import { toast } from 'sonner'
import SectorSelects from '@/components/dashboards/SectorSelects'
import type { SectorOption } from '@/lib/sector-options'
import { sectorCommandKey, sectorCommandName, subSectorKey, subSectorName } from '@/lib/sectors'

const MAX_BATCH = 200

export interface TrainingRow {
  id: string
  name: string
  sectorCommand: string | null
  subSector: string | null
  rank: string | null
  approvedOn: string
}

export default function TrainingQueueTable({ rows, sectors }: { rows: TrainingRow[]; sectors: SectorOption[] }) {
  const router = useRouter()
  const [pickedSector, setSector] = useState('')
  const [pickedSub, setSub] = useState('')
  // A choice stops applying once nobody is left under it.
  const current = sectors.find((s) => s.key === pickedSector)
  const sector = current ? pickedSector : ''
  const sub = current?.subs.some((s) => s.key === pickedSub) ? pickedSub : ''
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        if (sector && sectorCommandKey(r.sectorCommand) !== sector) return false
        return !sub || subSectorKey(r.sectorCommand, r.subSector) === sub
      }),
    [rows, sector, sub]
  )

  // Only what is on screen can be confirmed.
  const chosen = shown.filter((r) => selected.has(r.id))
  const selectable = shown.slice(0, MAX_BATCH)
  const allChosen = selectable.length > 0 && selectable.every((r) => selected.has(r.id))

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmTraining(ids: string[]) {
    setSending(true)
    try {
      const res = await fetch('/api/training-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationIds: ids }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(json.error ?? 'Could not confirm training.')
      else {
        toast.success(`${json.confirmed} applicant(s) confirmed — now in the print queue.${json.skipped ? ` ${json.skipped} skipped.` : ''}`)
        if (json.warning) toast.error(json.warning)
        setSelected(new Set())
      }
      router.refresh()
    } catch {
      toast.error('Network error. Refresh to see what was confirmed before trying again.')
    }
    setSending(false)
  }

  return (
    <Panel
      title="Pending Training Completion" icon={GraduationCap}
      aside={<Link href="/portal/admin/print-queue" className="font-semibold text-blue-700 hover:underline">Open print queue →</Link>}
    >
      {rows.length === 0 ? (
        <Empty>Nobody is waiting for training confirmation.</Empty>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 p-2">
            <SectorSelects
              options={sectors} sector={sector} sub={sub} countLabel="in training"
              onSector={(k) => { setSector(k); setSub(''); setSelected(new Set()) }}
              onSub={(k) => { setSub(k); setSelected(new Set()) }}
            />
            {chosen.length > 0 && (
              <Button
                onClick={() => { if (confirm(`Confirm training completed for ${chosen.length} applicant(s)?`)) confirmTraining(chosen.map((r) => r.id)) }}
                disabled={sending}
                className="h-[38px] bg-green-600 text-white hover:bg-green-700"
              >
                {sending ? 'Confirming…' : `Confirm training for ${chosen.length}`}
              </Button>
            )}
          </div>
          <p className="px-2 text-xs text-slate-500">
            Showing {shown.length} of {rows.length}.{' '}
            {sector ? 'Tick applicants to confirm them together.' : 'Pick a Sector to confirm several at once.'}
            {sector && shown.length > MAX_BATCH && ` “Select all” picks the first ${MAX_BATCH}.`}
          </p>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr className={headRow}>
                  <th className={`${th} w-8`}>
                    {sector && (
                      <input
                        type="checkbox" aria-label="Select all shown applicants" checked={allChosen}
                        onChange={() => setSelected(allChosen ? new Set() : new Set(selectable.map((r) => r.id)))}
                      />
                    )}
                  </th>
                  <th className={th}>S/N</th>
                  <th className={th}>Name</th>
                  <th className={th}>Sector</th>
                  <th className={th}>Sub-Sector</th>
                  <th className={th}>Rank</th>
                  <th className={th}>Approved</th>
                  <th className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={r.id} className={tr}>
                    <td className={td}>
                      <input type="checkbox" disabled={!sector} checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                    </td>
                    <td className={`${td} text-slate-500`}>{i + 1}</td>
                    <td className={`${td} font-semibold text-slate-900`}>{r.name}</td>
                    <td className={td}>{sectorCommandName(r.sectorCommand) || '—'}</td>
                    <td className={td}>{subSectorName(r.sectorCommand, r.subSector) || '—'}</td>
                    <td className={td}>{r.rank || '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>{r.approvedOn}</td>
                    <td className={td}>
                      <button type="button" onClick={() => confirmTraining([r.id])} disabled={sending} className={rowButton}>
                        Confirm
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  )
}
