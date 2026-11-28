'use client'

import type { SectorOption } from '@/lib/sector-options'
import { field, fieldLabel } from '@/components/dashboards/StaffUI'

interface Props {
  options: SectorOption[]
  sector: string
  sub: string
  /** what the counts mean, e.g. "waiting" */
  countLabel: string
  onSector: (key: string) => void
  onSub: (key: string) => void
}

/** Sector Command → Sub Sector pickers. Lists every sector; the sub sector list follows it. */
export default function SectorSelects({ options, sector, sub, countLabel, onSector, onSub }: Props) {
  const subs = options.find((o) => o.key === sector)?.subs ?? []
  return (
    <>
      <label className={`${fieldLabel} w-full sm:w-64`}>
        <span className="block">Sector</span>
        <select className={field} value={sector} onChange={(e) => onSector(e.target.value)}>
          <option value="">All sectors</option>
          {options.map((o) => <option key={o.key} value={o.key}>{o.name} — {o.count} {countLabel}</option>)}
        </select>
      </label>
      <label className={`${fieldLabel} w-full sm:w-64`}>
        <span className="block">Sub-Sector</span>
        <select className={field} value={sub} disabled={!sector} onChange={(e) => onSub(e.target.value)}>
          <option value="">{sector ? 'All sub-sectors' : 'Pick a sector first'}</option>
          {subs.map((o) => <option key={o.key} value={o.key}>{o.name} — {o.count} {countLabel}</option>)}
        </select>
      </label>
    </>
  )
}
