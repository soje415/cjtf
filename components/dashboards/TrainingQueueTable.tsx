'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { toast } from 'sonner'
import SectorSelects from '@/components/dashboards/SectorSelects'
import type { SectorOption } from '@/lib/sector-options'
import { sectorCommandKey, subSectorKey, subSectorName } from '@/lib/sectors'

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
  const [sector, setSector] = useState('')
  const [sub, setSub] = useState('')
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Pending Training Completion</CardTitle>
          <LinkButton href="/portal/admin/print-queue" size="sm" variant="outline" className="text-xs border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
            Open print queue →
          </LinkButton>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">Nobody is waiting for training confirmation.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <SectorSelects
                options={sectors} sector={sector} sub={sub} countLabel="in training"
                onSector={(k) => { setSector(k); setSub(''); setSelected(new Set()) }}
                onSub={(k) => { setSub(k); setSelected(new Set()) }}
              />
              {chosen.length > 0 && (
                <Button
                  onClick={() => { if (confirm(`Confirm training completed for ${chosen.length} applicant(s)?`)) confirmTraining(chosen.map((r) => r.id)) }}
                  disabled={sending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {sending ? 'Confirming…' : `Confirm training for ${chosen.length}`}
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Showing {shown.length} of {rows.length}.{' '}
              {sector ? 'Tick applicants to confirm them together.' : 'Pick a Sector Command to confirm several at once.'}
              {sector && shown.length > MAX_BATCH && ` “Select all” picks the first ${MAX_BATCH}.`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase">
                    <th className="w-8 pb-2 pr-2 text-left">
                      {sector && (
                        <input
                          type="checkbox" aria-label="Select all shown applicants" checked={allChosen}
                          onChange={() => setSelected(allChosen ? new Set() : new Set(selectable.map((r) => r.id)))}
                        />
                      )}
                    </th>
                    <th className="text-left pb-2 pr-4">Name</th>
                    <th className="text-left pb-2 pr-4">Sector Command</th>
                    <th className="text-left pb-2 pr-4">Sub Sector</th>
                    <th className="text-left pb-2 pr-4">Rank</th>
                    <th className="text-left pb-2 pr-4">Cleared</th>
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
                      <td className="py-2 pr-4 text-gray-600">{r.sectorCommand || '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{subSectorName(r.sectorCommand, r.subSector) || '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{r.rank || '—'}</td>
                      <td className="py-2 pr-4 text-gray-500">{r.approvedOn}</td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          onClick={() => confirmTraining([r.id])}
                          disabled={sending}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700"
                        >
                          Confirm Training Completed
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
