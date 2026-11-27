import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import ScreeningQueue, { ScreeningRow } from '@/components/dashboards/ScreeningQueue'
import { buildSectorOptions, SectorPair } from '@/lib/sector-options'
import { fetchAllRows } from '@/lib/fetch-all'
import { Application } from '@/lib/types'

export default async function IntDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'int') redirect('/auth/login')

  const apps = await fetchAllRows<Application>((from, to) =>
    service
      .from('applications')
      .select('*')
      .eq('status', 'PENDING_INT_SCREENING')
      .order('ict_verified_at', { ascending: true })
      .order('id')
      .range(from, to)
  )
  const everyone = await fetchAllRows<SectorPair>((from, to) =>
    service.from('applications').select('sector_command, sub_sector').order('id').range(from, to)
  )

  const list = apps
  const sectors = buildSectorOptions(everyone, list)
  const rows: ScreeningRow[] = list.map((a) => ({
    id: a.id,
    name: `${a.first_name} ${a.last_name}`.trim(),
    address: a.residential_address,
    sectorCommand: a.sector_command,
    subSector: a.sub_sector,
    verifiedOn: a.ict_verified_at ? new Date(a.ict_verified_at).toLocaleDateString('en-NG') : '—',
  }))

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

      <ScreeningQueue rows={rows} sectors={sectors} />

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
