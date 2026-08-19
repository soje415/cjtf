import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { STATUS_LABELS, STATUS_COLORS, MEMBERSHIP_TYPE_LABELS, MEMBERSHIP_TYPE_COLORS, Application } from '@/lib/types'

export default async function IctDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ict') redirect('/auth/login')

  const { data: pending } = await service
    .from('applications')
    .select('*, profiles!applications_applicant_id_fkey(full_name)')
    .eq('status', 'PENDING_ICT_VERIFICATION')
    .order('submitted_at', { ascending: true })

  const { data: generating } = await service
    .from('applications')
    .select('*, profiles!applications_applicant_id_fkey(full_name)')
    .eq('status', 'APPROVED_GENERATING_ID')
    .order('admin_approved_at', { ascending: true })

  const apps = pending as Application[] ?? []
  const idApps = generating as Application[] ?? []

  // Office permits awaiting ICT generation/printing (after Admin approval)
  const { data: officeRows } = await service
    .from('office_registrations')
    .select('id, office_name, first_name, last_name, area_council, district, cert_number, admin_approved_at')
    .eq('status', 'APPROVED_GENERATING_CERT')
    .order('admin_approved_at', { ascending: true })
  const officePermits = officeRows ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ICT Dashboard</h1>
        <p className="text-gray-500 text-sm">Review and verify applicant data</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-blue-600">{apps.length}</p>
            <p className="text-sm text-gray-500 mt-1">Pending Verification</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-teal-600">{idApps.length}</p>
            <p className="text-sm text-gray-500 mt-1">Ready for ID Generation</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-cjtf-green">{apps.length + idApps.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Active</p>
          </CardContent>
        </Card>
      </div>

      <ApplicationTable title="Pending ICT Verification" apps={apps} actionLabel="Review & Verify" />
      <ApplicationTable title="Ready for ID Generation" apps={idApps} actionLabel="Generate ID Card" />

      {/* Office permits to generate + print (handed off by Admin) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Office Permits to Issue</CardTitle></CardHeader>
        <CardContent>
          {officePermits.length === 0 ? (
            <p className="py-4 text-center text-gray-500 text-sm">No office permits awaiting issuance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase">
                    <th className="text-left pb-2 pr-4">Office</th>
                    <th className="text-left pb-2 pr-4">Registrant</th>
                    <th className="text-left pb-2 pr-4">Location</th>
                    <th className="text-left pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {officePermits.map((o) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{o.office_name}</td>
                      <td className="py-2 pr-4 text-gray-600">{o.first_name} {o.last_name}</td>
                      <td className="py-2 pr-4 text-gray-600">{o.area_council} / {o.district}</td>
                      <td className="py-2">
                        <LinkButton href={`/portal/ict/office/${o.id}`} size="sm" variant="outline" className="text-xs border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
                          Generate &amp; Print Permit
                        </LinkButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ApplicationTable({ title, apps, actionLabel }: { title: string; apps: Application[]; actionLabel: string }) {
  if (apps.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500 text-xs uppercase">
                <th className="text-left pb-2 pr-4">Name</th>
                <th className="text-left pb-2 pr-4">State / LGA</th>
                <th className="text-left pb-2 pr-4">Status</th>
                <th className="text-left pb-2 pr-4">Submitted</th>
                <th className="text-left pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{app.first_name} {app.last_name}</td>
                  <td className="py-2 pr-4 text-gray-600">{app.state_of_origin} / {app.lga_of_origin}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge className={MEMBERSHIP_TYPE_COLORS[app.membership_type]}>{MEMBERSHIP_TYPE_LABELS[app.membership_type]}</Badge>
                      <Badge className={STATUS_COLORS[app.status]}>{STATUS_LABELS[app.status]}</Badge>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-NG') : '—'}
                  </td>
                  <td className="py-2">
                    <LinkButton href={`/portal/ict/application/${app.id}`} size="sm" variant="outline" className="text-xs border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
                      {actionLabel}
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
