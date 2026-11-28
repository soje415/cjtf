import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Layers } from 'lucide-react'
import { Empty, Panel, headRow, rowButton, table, td, th, tr } from '@/components/dashboards/StaffUI'
import { LinkButton } from '@/components/ui/link-button'
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS, canViewBatches, canSendBatches, PrintBatch, BatchStatus } from '@/lib/print-batches'

const FILTERS: { value: 'open' | 'all' | BatchStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'with_admin', label: 'Awaiting Admin' },
  { value: 'with_ict', label: 'With ICT' },
  { value: 'printed', label: 'Printed' },
  { value: 'collected', label: 'Collected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

// Batch list — Admin's inbox of INT batches, ICT's inbox of forwarded batches, and INT's view of what they've sent.
export default async function PrintBatchesPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role as string | undefined
  if (!canViewBatches(role)) redirect('/auth/login')

  // Each role lands on the batches waiting on them.
  const defaultFilter = role === 'admin' ? 'with_admin' : role === 'ict' ? 'with_ict' : 'open'
  const filter = FILTERS.some((f) => f.value === searchParams.status) ? (searchParams.status as string) : defaultFilter
  let q = service.from('print_batches').select('*').order('created_at', { ascending: false }).limit(200)
  if (filter === 'open') q = q.in('status', ['with_admin', 'with_ict'])
  else if (filter !== 'all') q = q.eq('status', filter)
  const { data } = await q
  const batches = (data ?? []) as PrintBatch[]

  // Who sent each batch.
  const requesterIds = [...new Set(batches.map((b) => b.requested_by).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (requesterIds.length) {
    const { data: ps } = await service.from('profiles').select('id, full_name').in('id', requesterIds)
    for (const p of ps ?? []) names.set(p.id, p.full_name)
  }

  const queueHref = role === 'admin' ? '/portal/admin/print-queue' : '/portal/int/print-queue'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Print Batches</h1>
          <p className="text-gray-500 text-sm">
            {role === 'ict'
              ? 'Batches forwarded to ICT for ID generation, by sector and sub-sector.'
              : role === 'admin'
                ? 'Batches INT has sent for your review, and where each one is now.'
                : 'Batches you have sent to Admin, and where each one is now.'}
          </p>
        </div>
        {canSendBatches(role) && (
          <LinkButton href={queueHref} className="h-10 bg-blue-600 px-4 text-white hover:bg-blue-700">Open print queue →</LinkButton>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <LinkButton
            key={f.value}
            href={`/portal/staff/print?status=${f.value}`}
            size="sm"
            variant={filter === f.value ? 'default' : 'outline'}
            className={`h-9 rounded-full px-4 ${filter === f.value ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            {f.label}
          </LinkButton>
        ))}
      </div>

      <Panel title="Batches" icon={Layers}>
        {batches.length === 0 ? (
          <Empty>No batches here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr className={headRow}>
                  <th className={th}>Batch</th>
                  <th className={th}>Sector / Sub Sector</th>
                  <th className={th}>Applicants</th>
                  <th className={th}>Sent by</th>
                  <th className={th}>Status</th>
                  <th className={th}>Created</th>
                  <th className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className={tr}>
                    <td className={`${td} font-semibold text-slate-900`}>{b.batch_no}</td>
                    <td className={td}>{b.sector_command} <span className="text-slate-400">/</span> {b.sub_sector}</td>
                    <td className={td}>{b.card_count}</td>
                    <td className={td}>
                      {(b.requested_by && names.get(b.requested_by)) || '—'}
                      {b.requested_role && <span className="text-xs text-slate-400"> ({b.requested_role.toUpperCase()})</span>}
                    </td>
                    <td className={td}><Badge className={BATCH_STATUS_COLORS[b.status]}>{BATCH_STATUS_LABELS[b.status]}</Badge></td>
                    <td className={`${td} whitespace-nowrap`}>{new Date(b.created_at).toLocaleDateString('en-NG')}</td>
                    <td className={td}>
                      <Link href={`/portal/staff/print/${b.id}`} className={rowButton}>
                        {role === 'admin' && b.status === 'with_admin' ? 'Review' : role === 'ict' && b.status === 'with_ict' ? 'Open' : 'View'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
