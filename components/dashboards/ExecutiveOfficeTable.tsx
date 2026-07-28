'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { OfficeRegistration, OfficeStatus, OFFICE_STATUS_LABELS, OFFICE_STATUS_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STATUS_ORDER: OfficeStatus[] = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PENDING_INT_SCREENING',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED_GENERATING_CERT',
  'COMPLETED',
  'REJECTED',
]

export default function ExecutiveOfficeTable({ registrations }: { registrations: OfficeRegistration[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | OfficeStatus>('ALL')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return registrations.filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false
      if (!q) return true
      const hay = [
        r.office_name, r.first_name, r.last_name, r.area_council, r.district, r.cert_number, r.phone_number,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [registrations, search, status])

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue'

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle className="text-base">All Office Registrations ({filtered.length})</CardTitle>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Search office, registrant, permit no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as 'ALL' | OfficeStatus)}>
            <option value="ALL">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{OFFICE_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-gray-500 text-sm">No office registrations match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-xs uppercase">
                  <th className="text-left pb-2 pr-4">Office</th>
                  <th className="text-left pb-2 pr-4">Registrant</th>
                  <th className="text-left pb-2 pr-4">Area Council / District</th>
                  <th className="text-left pb-2 pr-4">Stage</th>
                  <th className="text-left pb-2 pr-4">Permit No.</th>
                  <th className="text-left pb-2 pr-4">Submitted</th>
                  <th className="text-left pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{r.office_name}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.first_name} {r.last_name}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.area_council} / {r.district}</td>
                    <td className="py-2 pr-4">
                      <Badge className={OFFICE_STATUS_COLORS[r.status]}>{OFFICE_STATUS_LABELS[r.status]}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{r.cert_number || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-NG') : '—'}
                    </td>
                    <td className="py-2">
                      <Link href={`/portal/executive/office/${r.id}`}
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
