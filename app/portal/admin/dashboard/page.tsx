import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { Application, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

export default async function AdminDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/auth/login')

  const { data: pending } = await service
    .from('applications')
    .select('*')
    .eq('status', 'PENDING_ADMIN_APPROVAL')
    .order('int_cleared_at', { ascending: true })

  const { count: completedCount } = await service
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'COMPLETED')

  const { count: rejectedCount } = await service
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'REJECTED')

  const list = pending as Application[] ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Final approval and command oversight</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-orange-600">{list.length}</p>
            <p className="text-sm text-gray-500 mt-1">Pending Approval</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-cjtf-green">{completedCount ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-red-500">{rejectedCount ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-gray-500">No applications pending admin approval.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Applications Awaiting Approval</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase">
                    <th className="text-left pb-2 pr-4">Name</th>
                    <th className="text-left pb-2 pr-4">State / LGA</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-left pb-2 pr-4">INT Cleared</th>
                    <th className="text-left pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((app) => (
                    <tr key={app.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{app.first_name} {app.last_name}</td>
                      <td className="py-2 pr-4 text-gray-600">{app.state_of_origin} / {app.lga_of_origin}</td>
                      <td className="py-2 pr-4">
                        <Badge className={STATUS_COLORS[app.status]}>{STATUS_LABELS[app.status]}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {app.int_cleared_at ? new Date(app.int_cleared_at).toLocaleDateString('en-NG') : '—'}
                      </td>
                      <td className="py-2">
                        <LinkButton href={`/portal/admin/application/${app.id}`} size="sm" variant="outline" className="text-xs border-orange-500 text-orange-600 hover:bg-orange-50">
                          Review & Decide
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
    </div>
  )
}
