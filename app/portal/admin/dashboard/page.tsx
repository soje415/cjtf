import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import AdminPendingQueue, { PendingBatch, PendingRow } from '@/components/dashboards/AdminPendingQueue'
import { buildSectorOptions, SectorPair } from '@/lib/sector-options'
import { fetchAllRows } from '@/lib/fetch-all'
import { sectorCommandName } from '@/lib/sectors'
import { DEFAULT_RECOMMENDED_RANK, isValidRank } from '@/lib/ranks'
import { Application } from '@/lib/types'
import CreateExecutiveForm from '@/components/dashboards/CreateExecutiveForm'
import TrainingQueueTable, { TrainingRow } from '@/components/dashboards/TrainingQueueTable'

export default async function AdminDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/auth/login')

  // Ordered by updated_at, not int_cleared_at: legacy members skip INT
  // screening entirely, so int_cleared_at is always null for them, which
  // would otherwise sort them behind every INT-cleared row regardless of
  // actual queue-entry time.
  const pending = await fetchAllRows<Application>((from, to) =>
    service
      .from('applications')
      .select('*')
      .eq('status', 'PENDING_ADMIN_APPROVAL')
      .order('updated_at', { ascending: true })
      .order('id')
      .range(from, to)
  )
  const everyone = await fetchAllRows<SectorPair>((from, to) =>
    service.from('applications').select('sector_command, sub_sector').order('id').range(from, to)
  )

  const training = await fetchAllRows<Application>((from, to) =>
    service
      .from('applications')
      .select('*')
      .eq('status', 'PENDING_TRAINING')
      .order('admin_approved_at', { ascending: true })
      .order('id')
      .range(from, to)
  )

  const { count: completedCount } = await service
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'COMPLETED')

  const { count: rejectedCount } = await service
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'REJECTED')

  const list = pending
  const sectors = buildSectorOptions(everyone, list)

  // Applicants INT sent together share the exact int_cleared_at timestamp.
  const together = new Map<string, Application[]>()
  for (const a of list) {
    if (!a.int_cleared_at) continue
    together.set(a.int_cleared_at, [...(together.get(a.int_cleared_at) ?? []), a])
  }
  const batches: PendingBatch[] = Array.from(together.entries())
    .filter(([, members]) => members.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, members]) => {
      const when = new Date(key).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      return { key, label: `${sectorCommandName(members[0].sector_command)} — ${members.length} waiting — sent ${when}` }
    })
  const batchKeys = new Set(batches.map((b) => b.key))
  const suggest = (a: Application) => {
    const claimed = a.membership_type === 'legacy' ? a.self_reported_rank : null
    const staffRank = a.cjtf_rank ?? a.recommended_rank
    const rank = staffRank ?? claimed
    return isValidRank(rank)
      ? { suggestedRank: rank, selfReported: !staffRank }
      : { suggestedRank: DEFAULT_RECOMMENDED_RANK, selfReported: false }
  }
  const pendingRows: PendingRow[] = list.map((a) => ({
    ...suggest(a),
    id: a.id,
    name: `${a.first_name} ${a.last_name}`.trim(),
    address: a.residential_address,
    sectorCommand: a.sector_command,
    subSector: a.sub_sector,
    status: a.status,
    membershipType: a.membership_type,
    recommendedRank: a.recommended_rank,
    clearedOn: a.int_cleared_at ? new Date(a.int_cleared_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }) : '—',
    batchKey: a.int_cleared_at && batchKeys.has(a.int_cleared_at) ? a.int_cleared_at : null,
  }))
  const trainingRows: TrainingRow[] = training.map((a) => ({
    id: a.id,
    name: `${a.first_name} ${a.last_name}`.trim(),
    sectorCommand: a.sector_command,
    subSector: a.sub_sector,
    rank: a.cjtf_rank,
    approvedOn: a.admin_approved_at ? new Date(a.admin_approved_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }) : '—',
  }))
  const trainingSectors = buildSectorOptions(everyone, training)

  const { data: officeRows } = await service
    .from('office_registrations')
    .select('id, office_name, first_name, last_name, area_council, district, int_cleared_at')
    .eq('status', 'PENDING_ADMIN_APPROVAL')
    .order('int_cleared_at', { ascending: true })

  const offices = officeRows ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Final approval and command oversight</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-orange-600">{list.length}</p>
            <p className="text-sm text-gray-500 mt-1">Pending Approval</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-indigo-600">{trainingRows.length}</p>
            <p className="text-sm text-gray-500 mt-1">In Training</p>
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

      <AdminPendingQueue rows={pendingRows} sectors={sectors} batches={batches} />

      <TrainingQueueTable rows={trainingRows} sectors={trainingSectors} />

      {/* Office Registration requests awaiting final approval */}
      <Card>
        <CardHeader><CardTitle className="text-base">Office Registrations Awaiting Approval</CardTitle></CardHeader>
        <CardContent>
          {offices.length === 0 ? (
            <p className="py-4 text-center text-gray-500 text-sm">No office registrations awaiting approval.</p>
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
                        <LinkButton href={`/portal/admin/office/${o.id}`} size="sm" variant="outline" className="text-xs border-orange-500 text-orange-600 hover:bg-orange-50">
                          Review &amp; Approve
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

      <CreateExecutiveForm />
    </div>
  )
}
