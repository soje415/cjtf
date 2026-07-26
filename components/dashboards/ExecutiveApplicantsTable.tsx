'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Application, ApplicationStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Row = Application & { profiles?: { full_name: string } }

const STATUS_ORDER: ApplicationStatus[] = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PENDING_ICT_VERIFICATION',
  'PENDING_INT_SCREENING',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED_GENERATING_ID',
  'COMPLETED',
  'REJECTED',
]

export default function ExecutiveApplicantsTable({ applications }: { applications: Row[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | ApplicationStatus>('ALL')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return applications.filter((a) => {
      if (status !== 'ALL' && a.status !== status) return false
      if (!q) return true
      const hay = [
        a.first_name, a.last_name, a.middle_name, a.nin,
        a.cjtf_id_number, a.state_of_origin, a.lga_of_origin, a.phone_number,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [applications, search, status])

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue'

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle className="text-base">All Applicants ({filtered.length})</CardTitle>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Search name, NIN, CJTF ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as 'ALL' | ApplicationStatus)}>
            <option value="ALL">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-gray-500 text-sm">No applicants match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-xs uppercase">
                  <th className="text-left pb-2 pr-4">Name</th>
                  <th className="text-left pb-2 pr-4">NIN</th>
                  <th className="text-left pb-2 pr-4">State / LGA</th>
                  <th className="text-left pb-2 pr-4">Stage</th>
                  <th className="text-left pb-2 pr-4">CJTF ID</th>
                  <th className="text-left pb-2 pr-4">Submitted</th>
                  <th className="text-left pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{a.first_name} {a.last_name}</td>
                    <td className="py-2 pr-4 text-gray-600">{a.nin || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{a.state_of_origin} / {a.lga_of_origin}</td>
                    <td className="py-2 pr-4">
                      <Badge className={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{a.cjtf_id_number || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-NG') : '—'}
                    </td>
                    <td className="py-2">
                      <Link href={`/portal/executive/application/${a.id}`}
                        className="text-cjtf-blue hover:underline text-xs font-medium">
                        View →
                      </Link>
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
