import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Clock, GraduationCap, CheckCircle2, XCircle } from 'lucide-react'
import { StatCards, Stat } from '@/components/dashboards/StaffUI'
import OfficeRequestsPanel from '@/components/dashboards/OfficeRequestsPanel'
import AdminPendingQueue, { PendingBatch, PendingRow } from '@/components/dashboards/AdminPendingQueue'
import { buildSectorOptions } from '@/lib/sector-options'
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

  // Everyone here was sent by Intelligence (or resubmitted after an Admin
  // rejection). Ordered by updated_at, the time each one entered this queue.
  const pending = await fetchAllRows<Application>((from, to) =>
    service
      .from('applications')
      .select('*')
      .eq('status', 'PENDING_ADMIN_APPROVAL')
      .order('updated_at', { ascending: true })
      .order('id')
      .range(from, to)
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
  // Only the sectors actually waiting here are offered, so the filters show
  // nothing beyond what Intelligence has sent.
  const sectors = buildSectorOptions(list, list)

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
    membershipType: a.membership_type,
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
  const trainingSectors = buildSectorOptions(training, training)

  const { data: officeRows } = await service
    .from('office_registrations')
    .select('id, office_name, first_name, last_name, area_council, district, int_cleared_at')
    .eq('status', 'PENDING_ADMIN_APPROVAL')
    .order('int_cleared_at', { ascending: true })

  const offices = officeRows ?? []

  const stats: Stat[] = [
    { label: 'Pending Approval', value: list.length, icon: Clock, tone: 'amber' },
    { label: 'In Training', value: trainingRows.length, icon: GraduationCap, tone: 'violet' },
    { label: 'Completed', value: completedCount ?? 0, icon: CheckCircle2, tone: 'green' },
    { label: 'Rejected', value: rejectedCount ?? 0, icon: XCircle, tone: 'red' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900 lg:sr-only">Admin Approval Dashboard</h1>

      <StatCards stats={stats} />

      <AdminPendingQueue rows={pendingRows} sectors={sectors} batches={batches} />

      <TrainingQueueTable rows={trainingRows} sectors={trainingSectors} />

      <OfficeRequestsPanel
        title="Office Registrations Awaiting Approval" offices={offices} hrefBase="/portal/admin/office"
        action="Review" empty="No office registrations awaiting approval."
      />

      <CreateExecutiveForm />
    </div>
  )
}
