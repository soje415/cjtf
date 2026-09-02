import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { Application, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

export default async function IntDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'int') redirect('/auth/login')

  const { data: apps } = await service
    .from('applications')
    .select('*, profiles!applications_applicant_id_fkey(full_name)')
    .eq('status', 'PENDING_INT_SCREENING')
    .order('ict_verified_at', { ascending: true })

  const list = apps as Application[] ?? []

  const { data: officeRows } = await service
    .from('office_registrations')
    .select('id, office_name, first_name, last_name, area_council, district, submitted_at')
    .eq('status', 'PENDING_INT_SCREENING')
    .order('submitted_at', { ascending: true })

  const offices = officeRows ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Intelligence Dashboard</h1>
        <p className="text-gray-500 text-sm">Screen applicants forwarded by ICT</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-purple-600">{list.length}</p>
            <p className="text-sm text-gray-500 mt-1">Pending Screening</p>
          </CardContent>
        </Card>
      </div>

      {list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-gray-500">No applications pending screening.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Applications for Screening</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase">
                    <th className="text-left pb-2 pr-4">Name</th>
                    <th className="text-left pb-2 pr-4">Address</th>
                    <th className="text-left pb-2 pr-4">Sector Command</th>
                    <th className="text-left pb-2 pr-4">Sub Sector</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-left pb-2 pr-4">ICT Verified</th>
                    <th className="text-left pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((app) => (
                    <tr key={app.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{app.first_name} {app.last_name}</td>
                      <td className="py-2 pr-4 text-gray-600">{app.residential_address || '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{app.sector_command || '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{app.sub_sector || '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge className={STATUS_COLORS[app.status]}>{STATUS_LABELS[app.status]}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {app.ict_verified_at ? new Date(app.ict_verified_at).toLocaleDateString('en-NG') : '—'}
                      </td>
                      <td className="py-2">
                        <LinkButton href={`/portal/int/application/${app.id}`} size="sm" variant="outline" className="text-xs border-purple-600 text-purple-700 hover:bg-purple-50">
                          Screen Application
                        </LinkButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Office Registration requests for screening */}
      <Card>
        <CardHeader><CardTitle className="text-base">Office Registration Requests</CardTitle></CardHeader>
        <CardContent>
          {offices.length === 0 ? (
            <p className="py-4 text-center text-gray-500 text-sm">No office requests pending screening.</p>
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
                  {offices.map((o) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{o.office_name}</td>
                      <td className="py-2 pr-4 text-gray-600">{o.first_name} {o.last_name}</td>
                      <td className="py-2 pr-4 text-gray-600">{o.area_council} / {o.district}</td>
                      <td className="py-2">
                        <LinkButton href={`/portal/int/office/${o.id}`} size="sm" variant="outline" className="text-xs border-cjtf-blue text-cjtf-blue hover:bg-blue-50">
                          Screen Request
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
