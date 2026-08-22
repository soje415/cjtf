import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { STATUS_LABELS, STATUS_COLORS, MEMBERSHIP_TYPE_LABELS, MEMBERSHIP_TYPE_COLORS, OFFICE_STATUS_LABELS, Application, OfficeRegistration } from '@/lib/types'

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

  // In-progress drafts ICT started but hasn't submitted yet — quick resume.
  const { data: draftRows } = await service
    .from('applications')
    .select('*')
    .in('status', ['DRAFT', 'REJECTED'])
    .order('updated_at', { ascending: false })
    .limit(20)
  const drafts = (draftRows ?? []) as Application[]

  const { data: officeDraftRows } = await service
    .from('office_registrations')
    .select('*')
    .in('status', ['DRAFT', 'REJECTED'])
    .order('updated_at', { ascending: false })
    .limit(20)
  const officeDrafts = (officeDraftRows ?? []) as OfficeRegistration[]

  // Awaiting payment — ICT collects the fee here ("I have paid" / bank transfer).
  const { data: paymentRows } = await service
    .from('applications')
    .select('*')
    .eq('status', 'PENDING_PAYMENT')
    .order('submitted_at', { ascending: true })
  const pendingPayment = (paymentRows ?? []) as Application[]

  const { data: officePaymentRows } = await service
    .from('office_registrations')
    .select('*')
    .eq('status', 'PENDING_PAYMENT')
    .order('submitted_at', { ascending: true })
  const pendingPaymentOffices = (officePaymentRows ?? []) as OfficeRegistration[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ICT Dashboard</h1>
        <p className="text-gray-500 text-sm">Register applicants/offices and drive each record to completion</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <LinkButton href="/portal/staff/application/new?type=new" className="bg-cjtf-green hover:bg-cjtf-green-dark">
            + New Applicant
          </LinkButton>
          <LinkButton href="/portal/staff/application/new?type=legacy" variant="outline" className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
            + New Legacy Member
          </LinkButton>
          <LinkButton href="/portal/staff/office/new" variant="outline" className="border-cjtf-blue text-cjtf-blue hover:bg-cjtf-blue-light">
            + New Office Registration
          </LinkButton>
        </CardContent>
      </Card>

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

      {(pendingPayment.length > 0 || pendingPaymentOffices.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Awaiting Payment</CardTitle></CardHeader>
          <CardContent>
            {pendingPayment.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-gray-500">Applicant · {MEMBERSHIP_TYPE_LABELS[p.membership_type]} · {STATUS_LABELS[p.status]}</p>
                </div>
                <LinkButton href={`/portal/staff/application/${p.id}`} size="sm" className="text-xs bg-cjtf-green text-white hover:bg-cjtf-green-dark">
                  Collect Payment
                </LinkButton>
              </div>
            ))}
            {pendingPaymentOffices.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{o.office_name || '—'}</p>
                  <p className="text-xs text-gray-500">Office · {o.first_name} {o.last_name} · {OFFICE_STATUS_LABELS[o.status]}</p>
                </div>
                <LinkButton href={`/portal/staff/office/${o.id}`} size="sm" className="text-xs bg-cjtf-green text-white hover:bg-cjtf-green-dark">
                  Collect Payment
                </LinkButton>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      {(drafts.length > 0 || officeDrafts.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">In-progress Drafts</CardTitle></CardHeader>
          <CardContent>
            {drafts.length === 0 && officeDrafts.length === 0 && (
              <p className="py-4 text-center text-gray-500 text-sm">No drafts in progress.</p>
            )}
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{d.first_name || '—'} {d.last_name || ''}</p>
                  <p className="text-xs text-gray-500">Applicant · {MEMBERSHIP_TYPE_LABELS[d.membership_type]} · {STATUS_LABELS[d.status]}</p>
                </div>
                <LinkButton href={`/portal/staff/application/${d.id}`} size="sm" variant="outline" className="text-xs border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
                  Continue
                </LinkButton>
              </div>
            ))}
            {officeDrafts.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{o.office_name || '—'}</p>
                  <p className="text-xs text-gray-500">Office · {o.first_name} {o.last_name} · {OFFICE_STATUS_LABELS[o.status]}</p>
                </div>
                <LinkButton href={`/portal/staff/office/${o.id}`} size="sm" variant="outline" className="text-xs border-cjtf-blue text-cjtf-blue hover:bg-cjtf-blue-light">
                  Continue
                </LinkButton>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
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
