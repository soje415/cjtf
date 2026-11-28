'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Filter, IdCard, Search, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, Panel, Pill, field, fieldLabel, headRow, rowButton, table, td, th, tr } from '@/components/dashboards/StaffUI'
import type { SectorOption } from '@/lib/sector-options'
import { sectorCommandKey, sectorCommandName, subSectorKey, subSectorName } from '@/lib/sectors'
import { MEMBERSHIP_TYPE_LABELS, MembershipType } from '@/lib/types'

export interface IctRow {
  id: string
  name: string
  membershipType: MembershipType
  origin: string
  sectorCommand: string | null
  subSector: string | null
  rank: string | null
  submittedOn: string
}

export default function IctQueues({ verification, generation, sectors }: { verification: IctRow[]; generation: IctRow[]; sectors: SectorOption[] }) {
  const [pickedSector, setSector] = useState('')
  const [pickedSub, setSub] = useState('')
  // a typed name waits for Search / Enter; the dropdowns filter at once
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')

  // A choice stops applying once nobody is left under it.
  const current = sectors.find((s) => s.key === pickedSector)
  const subs = current?.subs ?? []
  const sector = current ? pickedSector : ''
  const sub = subs.some((s) => s.key === pickedSub) ? pickedSub : ''
  const filtering = !!(sector || query.trim())
  const narrow = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows: IctRow[]) =>
      rows.filter(
        (r) =>
          (!sector || sectorCommandKey(r.sectorCommand) === sector) &&
          (!sub || subSectorKey(r.sectorCommand, r.subSector) === sub) &&
          (!q || r.name.toLowerCase().includes(q))
      )
  }, [sector, sub, query])

  return (
    <div className="space-y-5">
      <Panel title="Find Applicants" icon={Filter}>
        <form
          className="grid grid-cols-1 items-end gap-3 p-2 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => { e.preventDefault(); setQuery(name) }}
        >
          <label className={fieldLabel}>
            <span>Sector</span>
            <select className={field} value={sector} onChange={(e) => { setSector(e.target.value); setSub('') }}>
              <option value="">All sectors</option>
              {sectors.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.count})</option>)}
            </select>
          </label>
          <label className={fieldLabel}>
            <span>Sub-Sector</span>
            <select className={field} value={sub} disabled={!sector} onChange={(e) => setSub(e.target.value)}>
              <option value="">{sector ? 'All sub-sectors' : 'Pick a sector first'}</option>
              {subs.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.count})</option>)}
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
            <Button type="button" variant="outline" className="h-[38px]" onClick={() => { setSector(''); setSub(''); setName(''); setQuery('') }}>
              Clear
            </Button>
          </div>
        </form>
      </Panel>

      <Queue
        title="Pending ICT Verification" icon={ShieldCheck} rows={narrow(verification)} total={verification.length}
        action="Verify" status={<Pill tone="blue">To verify</Pill>}
        empty={filtering ? 'No one here matches these filters.' : 'Nothing waiting for verification.'}
      />
      <Queue
        title="Ready for ID Generation" icon={IdCard} rows={narrow(generation)} total={generation.length}
        action="Generate ID" status={<Pill tone="green">Ready</Pill>} showRank
        empty={filtering ? 'No one here matches these filters.' : 'No ID cards waiting to be generated.'}
      />
    </div>
  )
}

function Queue({ title, icon, rows, total, action, status, empty, showRank }: {
  title: string
  icon: LucideIcon
  rows: IctRow[]
  total: number
  action: string
  status: React.ReactNode
  empty: string
  showRank?: boolean
}) {
  return (
    <Panel title={title} icon={icon} aside={total > 0 ? `Showing ${rows.length} of ${total}` : undefined}>
      {rows.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr className={headRow}>
                <th className={th}>S/N</th>
                <th className={th}>Name</th>
                <th className={th}>State / LGA</th>
                <th className={th}>Sector</th>
                <th className={th}>Sub-Sector</th>
                {showRank && <th className={th}>Rank</th>}
                <th className={th}>Status</th>
                <th className={th}>Submitted</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={tr}>
                  <td className={`${td} text-slate-500`}>{i + 1}</td>
                  <td className={td}>
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{MEMBERSHIP_TYPE_LABELS[r.membershipType]}</p>
                  </td>
                  <td className={td}>{r.origin}</td>
                  <td className={td}>{sectorCommandName(r.sectorCommand) || '—'}</td>
                  <td className={td}>{subSectorName(r.sectorCommand, r.subSector) || '—'}</td>
                  {showRank && <td className={td}>{r.rank || '—'}</td>}
                  <td className={td}>{status}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.submittedOn}</td>
                  <td className={td}><Link href={`/portal/ict/application/${r.id}`} className={rowButton}>{action}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
