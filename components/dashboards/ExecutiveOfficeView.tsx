import Link from 'next/link'
import { OfficeRegistration, OFFICE_STATUS_LABELS, OFFICE_STATUS_COLORS } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface NoteRow {
  id: string
  note: string
  action: string
  created_at: string
  profiles?: { full_name: string; role: string }
}

interface PaymentRow {
  id: string
  type: string
  amount: number
  status: string
}

interface Props {
  registration: OfficeRegistration
  payments: PaymentRow[]
  notes: NoteRow[]
}

const ROLE_BORDER: Record<string, string> = {
  ict: 'border-blue-400',
  int: 'border-purple-400',
  admin: 'border-orange-400',
}

export default function ExecutiveOfficeView({ registration, payments, notes }: Props) {
  const r = registration

  const timeline = [
    ['Submitted', r.submitted_at],
    ['INT Cleared', r.int_cleared_at],
    ['Admin Approved', r.admin_approved_at],
    ['Completed', r.completed_at],
  ] as const

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/portal/executive/dashboard" className="text-xs text-cjtf-blue hover:underline">← Back to oversight</Link>
          <h1 className="text-xl font-bold text-gray-800 mt-1">{r.office_name}</h1>
          <p className="text-sm text-gray-500">Read-only oversight view — Office Registration</p>
        </div>
        <Badge className={OFFICE_STATUS_COLORS[r.status]}>{OFFICE_STATUS_LABELS[r.status]}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Registrant</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Full Name', [r.title, r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ')],
            ['Identity', r.identity_verified ? `Verified (${r.identity_verify_method?.toUpperCase()})` : r.identity_verify_waived ? 'Skipped (unverified)' : 'Not verified'],
            ['Phone', r.phone_number || '—'],
            ['Email', r.email || '—'],
            ['Residential Address', r.residential_address || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="font-medium break-words">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Office Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Office Name', r.office_name || '—'],
            ['Office Type', r.office_designation || '—'],
            ['Area Council', r.area_council || '—'],
            ['District', r.district || '—'],
            ['Office Address', r.office_address || '—'],
            ['Landmark', r.landmark || '—'],
            ['District Head', r.district_head_name || '—'],
            ['Permit No.', r.cert_number || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="font-medium break-words">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Photos &amp; Endorsement</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {r.office_photo_urls.length > 0 ? (
            r.office_photo_urls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 rounded border border-cjtf-blue text-cjtf-blue hover:bg-blue-50">
                Office Photo {i + 1} ↗
              </a>
            ))
          ) : (
            <span className="px-3 py-1.5 rounded border border-gray-200 text-gray-400">No office photos</span>
          )}
          {r.endorsement_doc_url ? (
            <a href={r.endorsement_doc_url} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded border border-cjtf-blue text-cjtf-blue hover:bg-blue-50">
              District Head Endorsement ↗
            </a>
          ) : (
            <span className="px-3 py-1.5 rounded border border-gray-200 text-gray-400">Endorsement (none)</span>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Records</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between items-center text-sm">
                <span className="capitalize">{p.type.replace('_', ' ')} Fee</span>
                <span>₦{(p.amount / 100).toLocaleString()}</span>
                <Badge className={p.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Stage Timeline</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-center">
          {timeline.map(([label, ts]) => (
            <div key={label} className="rounded-lg bg-gray-50 p-2">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-medium text-xs mt-1">{ts ? new Date(ts).toLocaleDateString('en-NG') : '—'}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {notes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Full Processing Trail</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className={`text-sm border-l-2 pl-3 ${ROLE_BORDER[n.profiles?.role ?? ''] ?? 'border-gray-300'}`}>
                <p className="font-medium text-gray-700">{n.note}</p>
                <p className="text-xs text-gray-400">
                  {n.profiles?.full_name} ({n.profiles?.role}) — {new Date(n.created_at).toLocaleString('en-NG')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
