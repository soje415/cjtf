'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface QueueRow {
  id: string
  name: string
  cjtfId: string | null
  unit: string | null
  hasCard: boolean
}

export interface QueueGroup {
  groupKey: string
  sectorCommand: string
  subSector: string
  assigned: boolean
  rows: QueueRow[]
}

export default function PrintQueueClient({ groups }: { groups: QueueGroup[] }) {
  const router = useRouter()
  // selected ids per group
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)

  // Group by sector command for a two-level display.
  const bySector = useMemo(() => {
    const m = new Map<string, QueueGroup[]>()
    for (const g of groups) {
      const list = m.get(g.sectorCommand) ?? []
      list.push(g)
      m.set(g.sectorCommand, list)
    }
    return [...m.entries()]
  }, [groups])

  function toggle(groupKey: string, id: string) {
    setSelected((s) => {
      const next = new Set(s[groupKey] ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...s, [groupKey]: next }
    })
  }

  function toggleAll(g: QueueGroup) {
    const ready = g.rows.filter((r) => r.hasCard).map((r) => r.id)
    setSelected((s) => {
      const cur = s[g.groupKey] ?? new Set<string>()
      const all = ready.every((id) => cur.has(id))
      return { ...s, [g.groupKey]: new Set(all ? [] : ready) }
    })
  }

  async function send(g: QueueGroup) {
    const ids = [...(selected[g.groupKey] ?? [])]
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
        toast.success(`${ids.length} card(s) sent to ICT — batch ${json.batch?.batch_no ?? ''}`)
        setSelected((s) => ({ ...s, [g.groupKey]: new Set() }))
        router.refresh()
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setSending(null)
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          No completed ID cards are waiting to be sent for printing.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {bySector.map(([sector, subs]) => (
        <div key={sector} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {sector} <span className="font-normal normal-case text-gray-400">· {subs.reduce((n, g) => n + g.rows.length, 0)} card(s)</span>
          </h2>
          {subs.map((g) => {
            const sel = selected[g.groupKey] ?? new Set<string>()
            const ready = g.rows.filter((r) => r.hasCard)
            const isOpen = open[g.groupKey]
            return (
              <Card key={g.groupKey}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{g.subSector}</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {g.rows.length} completed card(s) · {ready.length} ready to print
                        {g.rows.length - ready.length > 0 && ` · ${g.rows.length - ready.length} missing card file`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!g.assigned && <Badge className="bg-red-100 text-red-700">Sector missing</Badge>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen((o) => ({ ...o, [g.groupKey]: !isOpen }))}
                      >
                        {isOpen ? 'Hide cards' : 'Review cards'}
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
                                  aria-label="Select all ready cards"
                                  checked={ready.length > 0 && ready.every((r) => sel.has(r.id))}
                                  onChange={() => toggleAll(g)}
                                />
                              )}
                            </th>
                            <th className="text-left pb-2 pr-4">Name</th>
                            <th className="text-left pb-2 pr-4">CJTF ID</th>
                            <th className="text-left pb-2">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((r) => (
                            <tr key={r.id} className="border-b last:border-0">
                              <td className="py-1.5">
                                <input
                                  type="checkbox"
                                  disabled={!g.assigned || !r.hasCard}
                                  checked={sel.has(r.id)}
                                  onChange={() => toggle(g.groupKey, r.id)}
                                  aria-label={`Select ${r.name}`}
                                />
                              </td>
                              <td className="py-1.5 pr-4 font-medium">{r.name}</td>
                              <td className="py-1.5 pr-4 text-gray-600">{r.cjtfId ?? '—'}</td>
                              <td className="py-1.5 text-gray-600">
                                {r.unit || '—'}
                                {!r.hasCard && <span className="ml-2 text-xs text-amber-700">no card file</span>}
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
                          placeholder="Note for ICT (optional)"
                          maxLength={500}
                          className="flex-1 min-w-[200px] border rounded px-3 py-1.5 text-sm"
                        />
                        <Button
                          onClick={() => send(g)}
                          disabled={sel.size === 0 || sending === g.groupKey}
                          className="bg-cjtf-green hover:bg-cjtf-green-dark"
                        >
                          {sending === g.groupKey ? 'Sending…' : `Send ${sel.size} to ICT for printing`}
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
