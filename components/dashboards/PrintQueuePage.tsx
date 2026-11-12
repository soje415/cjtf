import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { LinkButton } from '@/components/ui/link-button'
import { groupBySector } from '@/lib/sectors'
import { canSendBatches } from '@/lib/print-batches'
import PrintQueueClient, { QueueGroup } from '@/components/dashboards/PrintQueueClient'

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
    .select('id, first_name, last_name, cjtf_id_number, unit, sector_command, sub_sector, id_card_pdf_url', { count: 'exact' })
    .eq('status', 'COMPLETED')
    .eq('print_status', 'not_queued')
    .order('completed_at', { ascending: true })
    .limit(1000)

  const rows = data ?? []
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
      hasCard: !!r.id_card_pdf_url,
    })),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ID Card Print Queue</h1>
          <p className="text-gray-500 text-sm">
            Completed ID cards grouped by Sector Command and Sub Sector. Review a group and send it to ICT for printing.
          </p>
        </div>
        <LinkButton href="/portal/staff/print" variant="outline" className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
          Print batches →
        </LinkButton>
      </div>
      {(count ?? 0) > rows.length && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Showing the first {rows.length} of {count} waiting cards. Send these, then refresh for the rest.
        </p>
      )}
      <PrintQueueClient groups={groups} />
    </div>
  )
}
