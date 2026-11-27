import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { LinkButton } from '@/components/ui/link-button'
import { groupBySector } from '@/lib/sectors'
import { canSendBatches, BATCHABLE_STATUSES } from '@/lib/print-batches'
import PrintQueueClient, { QueueGroup } from '@/components/dashboards/PrintQueueClient'
import { buildSectorOptions, SectorPair } from '@/lib/sector-options'
import { fetchAllRows } from '@/lib/fetch-all'

// Shared by /portal/int/print-queue and /portal/admin/print-queue.
export default async function PrintQueuePage({ role }: { role: 'int' | 'admin' }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== role || !canSendBatches(profile?.role)) redirect('/auth/login')

  const { data, count } = await service
    .from('applications')
    .select('id, first_name, last_name, cjtf_id_number, unit, sector_command, sub_sector, status', { count: 'exact' })
    .in('status', [...BATCHABLE_STATUSES])
    .eq('print_status', 'not_queued')
    .order('last_name', { ascending: true })
    .limit(1000)

  // Admin: batches INT has sent that are waiting to be forwarded.
  let awaitingAdmin = 0
  if (role === 'admin') {
    const { count: n } = await service
      .from('print_batches').select('id', { count: 'exact', head: true }).eq('status', 'with_admin')
    awaitingAdmin = n ?? 0
  }

  const rows = data ?? []
  const everyone = await fetchAllRows<SectorPair>((from, to) =>
    service.from('applications').select('sector_command, sub_sector').order('id').range(from, to)
  )
  const sectors = buildSectorOptions(everyone, rows)
  const groups: QueueGroup[] = groupBySector(rows).map((g) => ({
    groupKey: g.groupKey,
    sectorCommand: g.sectorCommand,
    subSector: g.subSector,
    assigned: g.assigned,
    rows: g.rows.map((r) => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      cjtfId: r.cjtf_id_number,
      unit: r.unit,
      carded: r.status === 'COMPLETED',
    })),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ID Issuance Queue</h1>
          <p className="text-gray-500 text-sm">
            Approved applicants, filtered by Sector Command, Sub Sector and Unit.{' '}
            {role === 'int'
              ? 'Pick a group and send it to Admin as a batch; Admin forwards it to ICT, who generates each ID.'
              : 'Pick a group and send it straight to ICT, who generates each ID. Batches from INT are on the Print Batches page.'}
          </p>
        </div>
        <LinkButton href="/portal/staff/print" variant="outline" className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
          Print batches →
        </LinkButton>
      </div>
      {role === 'admin' && awaitingAdmin > 0 && (
        <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded px-3 py-2">
          {awaitingAdmin} batch(es) from INT are waiting for your review.{' '}
          <a href="/portal/staff/print?status=with_admin" className="underline font-medium">Review them →</a>
        </p>
      )}
      {(count ?? 0) > rows.length && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Showing the first {rows.length} of {count} waiting applicants. Send these, then refresh for the rest.
        </p>
      )}
      <PrintQueueClient groups={groups} sectors={sectors} role={role} />
    </div>
  )
}
