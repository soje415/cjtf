import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { Empty, Panel, headRow, rowButton, table, td, th, tr } from '@/components/dashboards/StaffUI'

export interface OfficeRequest {
  id: string
  office_name: string | null
  first_name: string | null
  last_name: string | null
  area_council: string | null
  district: string | null
}

/** Office registrations waiting on one desk, with a button to open each. */
export default function OfficeRequestsPanel({ title, offices, hrefBase, action, empty }: {
  title: string
  offices: OfficeRequest[]
  hrefBase: string
  action: string
  empty: string
}) {
  return (
    <Panel title={title} icon={Building2} aside={offices.length > 0 ? `${offices.length} waiting` : undefined}>
      {offices.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr className={headRow}>
                <th className={th}>S/N</th>
                <th className={th}>Office</th>
                <th className={th}>Registrant</th>
                <th className={th}>Location</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {offices.map((o, i) => (
                <tr key={o.id} className={tr}>
                  <td className={`${td} text-slate-500`}>{i + 1}</td>
                  <td className={`${td} font-medium text-slate-900`}>{o.office_name || '—'}</td>
                  <td className={td}>{o.first_name} {o.last_name}</td>
                  <td className={td}>{o.area_council} / {o.district}</td>
                  <td className={td}><Link href={`${hrefBase}/${o.id}`} className={rowButton}>{action}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
