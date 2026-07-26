import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Application, ApplicationStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { logExecutiveAccess } from '@/lib/executive-log'
import ExecutiveApplicantsTable from '@/components/dashboards/ExecutiveApplicantsTable'

const FUNNEL: ApplicationStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_ICT_VERIFICATION',
  'PENDING_INT_SCREENING',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED_GENERATING_ID',
  'COMPLETED',
]

function avgDays(apps: Application[], from: keyof Application, to: keyof Application): string {
  const spans = apps
    .map((a) => {
      const f = a[from] as string | null
      const t = a[to] as string | null
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
    .select('*, profiles(full_name)')
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
    </div>
  )
}
