import Image from 'next/image'
import Link from 'next/link'
import { Application, Payment, ApplicationNote, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  application: Application
  payments: Payment[]
  notes: (ApplicationNote & { profiles?: { full_name: string; role: string } })[]
}

const ROLE_BORDER: Record<string, string> = {
  ict: 'border-blue-400',
  int: 'border-purple-400',
  admin: 'border-orange-400',
}

export default function ExecutiveApplicationView({ application, payments, notes }: Props) {
  const a = application
  const documents = [
    ['Passport Photo', a.passport_photo_url],
    ['ID Document', a.id_document_url],
    ['Birth Certificate', a.birth_cert_url],
  ] as const

  const timeline = [
    ['Submitted', a.submitted_at],
    ['ICT Verified', a.ict_verified_at],
    ['INT Cleared', a.int_cleared_at],
    ['Admin Approved', a.admin_approved_at],
    ['Completed', a.completed_at],
  ] as const

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/portal/executive/dashboard" className="text-xs text-cjtf-blue hover:underline">← Back to oversight</Link>
          <h1 className="text-xl font-bold text-gray-800 mt-1">{a.first_name} {a.last_name}</h1>
          <p className="text-sm text-gray-500">Read-only oversight view</p>
        </div>
        <Badge className={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {a.passport_photo_url && (
          <Card><CardContent className="p-4 text-center">
            <Image src={a.passport_photo_url} alt="Passport" width={120} height={140} className="mx-auto rounded object-cover" />
            <p className="text-xs text-gray-500 mt-2">Passport Photo</p>
          </CardContent></Card>
        )}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Applicant Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Full Name', `${a.first_name} ${a.middle_name ?? ''} ${a.last_name}`],
              ['Date of Birth', a.date_of_birth ?? '—'],
              ['Gender', a.gender ?? '—'],
              ['NIN', a.nin || '—'],
              ['State / LGA', `${a.state_of_origin} / ${a.lga_of_origin}`],
              ['Residential Address', a.residential_address || '—'],
              ['Phone', a.phone_number || '—'],
              ['Email', a.email || '—'],
              ['CJTF ID', a.cjtf_id_number || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className="font-medium break-words">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Next of Kin</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-sm">
          <div><p className="text-gray-500 text-xs">Name</p><p className="font-medium">{a.next_of_kin_name || '—'}</p></div>
          <div><p className="text-gray-500 text-xs">Phone</p><p className="font-medium">{a.next_of_kin_phone || '—'}</p></div>
          <div><p className="text-gray-500 text-xs">Relationship</p><p className="font-medium">{a.next_of_kin_relationship || '—'}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {documents.map(([label, url]) =>
            url ? (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 rounded border border-cjtf-blue text-cjtf-blue hover:bg-blue-50">
                {label} ↗
              </a>
            ) : (
              <span key={label} className="px-3 py-1.5 rounded border border-gray-200 text-gray-400">{label} (none)</span>
            )
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
        <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm text-center">
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
