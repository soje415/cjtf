import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Application, ApplicationStatus, STATUS_LABELS, STATUS_COLORS,
  OfficeRegistration, OfficeStatus, OFFICE_STATUS_LABELS, OFFICE_STATUS_COLORS,
} from '@/lib/types'
import { logExecutiveAccess } from '@/lib/executive-log'
import ExecutiveApplicantsTable from '@/components/dashboards/ExecutiveApplicantsTable'
import ExecutiveOfficeTable from '@/components/dashboards/ExecutiveOfficeTable'

const FUNNEL: ApplicationStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_ICT_VERIFICATION',
  'PENDING_INT_SCREENING',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED_GENERATING_ID',
  'COMPLETED',
]

const OFFICE_FUNNEL: OfficeStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_INT_SCREENING',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED_GENERATING_CERT',
  'COMPLETED',
]

function avgDays<T>(rows: T[], from: keyof T, to: keyof T): string {
  const spans = rows
    .map((a) => {
      const f = a[from] as unknown as string | null
      const t = a[to] as unknown as string | null
      if (!f || !t) return null
      return (new Date(t).getTime() - new Date(f).getTime()) / 86_400_000
    })
    .filter((v): v is number => v !== null && v >= 0)
  if (spans.length === 0) return '—'
  const mean = spans.reduce((s, v) => s + v, 0) / spans.length
  return mean < 1 ? `${Math.round(mean * 24)}h` : `${mean.toFixed(1)}d`
}

export default async function ExecutiveDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'executive') redirect('/auth/login')

  // Record this oversight access
  await logExecutiveAccess(service, user.id, 'view_dashboard')

  const { data } = await service
    .from('applications')
    .select('*, profiles!applications_applicant_id_fkey(full_name)')
    .order('updated_at', { ascending: false })

  const apps = (data as (Application & { profiles?: { full_name: string } })[]) ?? []

  const counts = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  const total = apps.length
  const completed = counts['COMPLETED'] ?? 0
  const rejected = counts['REJECTED'] ?? 0
  const inProgress = total - completed - rejected - (counts['DRAFT'] ?? 0)
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const stageTimes = [
    { label: 'ICT verification', value: avgDays(apps, 'submitted_at', 'ict_verified_at') },
    { label: 'INT screening', value: avgDays(apps, 'ict_verified_at', 'int_cleared_at') },
    { label: 'Admin approval', value: avgDays(apps, 'int_cleared_at', 'admin_approved_at') },
    { label: 'ID generation', value: avgDays(apps, 'admin_approved_at', 'completed_at') },
    { label: 'End-to-end', value: avgDays(apps, 'submitted_at', 'completed_at') },
  ]

  // ── Office Registrations (separate flow, same oversight) ──
  const { data: officeData } = await service
    .from('office_registrations')
    .select('*')
    .order('updated_at', { ascending: false })

  const offices = (officeData as OfficeRegistration[]) ?? []

  const officeCounts = offices.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  const officeTotal = offices.length
  const officeCompleted = officeCounts['COMPLETED'] ?? 0
  const officeRejected = officeCounts['REJECTED'] ?? 0
  const officeInProgress = officeTotal - officeCompleted - officeRejected - (officeCounts['DRAFT'] ?? 0)
  const officeCompletionRate = officeTotal > 0 ? Math.round((officeCompleted / officeTotal) * 100) : 0

  const officeStageTimes = [
    { label: 'INT screening', value: avgDays(offices, 'submitted_at', 'int_cleared_at') },
    { label: 'Admin approval', value: avgDays(offices, 'int_cleared_at', 'admin_approved_at') },
    { label: 'Permit issuance', value: avgDays(offices, 'admin_approved_at', 'completed_at') },
    { label: 'End-to-end', value: avgDays(offices, 'submitted_at', 'completed_at') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Executive Oversight</h1>
        <p className="text-gray-500 text-sm">Holistic, read-only view of the entire recruitment pipeline</p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-cjtf-blue">{total}</p>
          <p className="text-sm text-gray-500 mt-1">Total Applicants</p>
        </CardContent></Card>
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-orange-500">{inProgress}</p>
          <p className="text-sm text-gray-500 mt-1">In Progress</p>
        </CardContent></Card>
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-cjtf-green">{completed}</p>
          <p className="text-sm text-gray-500 mt-1">Completed ({completionRate}%)</p>
        </CardContent></Card>
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-red-500">{rejected}</p>
          <p className="text-sm text-gray-500 mt-1">Rejected</p>
        </CardContent></Card>
      </div>

      {/* Pipeline funnel */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Pipeline by Stage</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {FUNNEL.map((s) => (
              <div key={s} className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{counts[s] ?? 0}</p>
                <Badge className={`${STATUS_COLORS[s]} mt-1`}>{STATUS_LABELS[s]}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Average processing time per stage */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Average Processing Time</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
            {stageTimes.map((t) => (
              <div key={t.label} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xl font-bold text-cjtf-blue">{t.value}</p>
                <p className="text-xs text-gray-500 mt-1">{t.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Master applicant table */}
      <ExecutiveApplicantsTable applications={apps} />

      {/* ── Office Registrations (separate flow) ── */}
      <div className="pt-4 border-t">
        <h2 className="text-lg font-bold text-gray-800">Office Registrations</h2>
        <p className="text-gray-500 text-sm">Operational Permit requests, same read-only oversight</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-cjtf-blue">{officeTotal}</p>
          <p className="text-sm text-gray-500 mt-1">Total Offices</p>
        </CardContent></Card>
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-orange-500">{officeInProgress}</p>
          <p className="text-sm text-gray-500 mt-1">In Progress</p>
        </CardContent></Card>
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-cjtf-green">{officeCompleted}</p>
          <p className="text-sm text-gray-500 mt-1">Permits Issued ({officeCompletionRate}%)</p>
        </CardContent></Card>
        <Card className="text-center"><CardContent className="pt-6">
          <p className="text-3xl font-bold text-red-500">{officeRejected}</p>
          <p className="text-sm text-gray-500 mt-1">Rejected</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Office Pipeline by Stage</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {OFFICE_FUNNEL.map((s) => (
              <div key={s} className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{officeCounts[s] ?? 0}</p>
                <Badge className={`${OFFICE_STATUS_COLORS[s]} mt-1`}>{OFFICE_STATUS_LABELS[s]}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Office Average Processing Time</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {officeStageTimes.map((t) => (
              <div key={t.label} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xl font-bold text-cjtf-blue">{t.value}</p>
                <p className="text-xs text-gray-500 mt-1">{t.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ExecutiveOfficeTable registrations={offices} />
    </div>
  )
}
