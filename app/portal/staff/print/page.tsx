import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS, canViewBatches, canSendBatches, PrintBatch, BatchStatus } from '@/lib/print-batches'

const FILTERS: { value: 'open' | 'all' | BatchStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'printed', label: 'Printed' },
  { value: 'collected', label: 'Collected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

// Batch list — ICT's print inbox, and INT/Admin's view of what they've sent.
export default async function PrintBatchesPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role as string | undefined
  if (!canViewBatches(role)) redirect('/auth/login')

  const filter = FILTERS.some((f) => f.value === searchParams.status) ? (searchParams.status as string) : 'open'
  let q = service.from('print_batches').select('*').order('created_at', { ascending: false }).limit(200)
  if (filter === 'open') q = q.eq('status', 'sent')
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
            {role === 'ict' ? 'ID card batches sent to ICT for printing, by sector and sub-sector.' : 'ID card batches sent to ICT, with their print status.'}
          </p>
        </div>
        {canSendBatches(role) && (
          <LinkButton href={queueHref} className="bg-cjtf-green hover:bg-cjtf-green-dark">Open print queue →</LinkButton>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <LinkButton
            key={f.value}
            href={`/portal/staff/print?status=${f.value}`}
            size="sm"
            variant={filter === f.value ? 'default' : 'outline'}
            className={filter === f.value ? 'bg-cjtf-green hover:bg-cjtf-green-dark' : ''}
          >
            {f.label}
          </LinkButton>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Batches</CardTitle></CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No batches here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase">
                    <th className="text-left pb-2 pr-4">Batch</th>
                    <th className="text-left pb-2 pr-4">Sector / Sub Sector</th>
                    <th className="text-left pb-2 pr-4">Cards</th>
                    <th className="text-left pb-2 pr-4">Sent by</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-left pb-2 pr-4">Sent</th>
                    <th className="text-left pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{b.batch_no}</td>
                      <td className="py-2 pr-4">{b.sector_command} <span className="text-gray-400">/</span> {b.sub_sector}</td>
                      <td className="py-2 pr-4">{b.card_count}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {(b.requested_by && names.get(b.requested_by)) || '—'}
                        {b.requested_role && <span className="text-xs text-gray-400"> ({b.requested_role.toUpperCase()})</span>}
                      </td>
                      <td className="py-2 pr-4"><Badge className={BATCH_STATUS_COLORS[b.status]}>{BATCH_STATUS_LABELS[b.status]}</Badge></td>
                      <td className="py-2 pr-4 text-gray-500">{new Date(b.created_at).toLocaleDateString('en-NG')}</td>
                      <td className="py-2">
                        <LinkButton href={`/portal/staff/print/${b.id}`} size="sm" variant="outline" className="text-xs border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
                          {role === 'ict' && b.status === 'sent' ? 'Open & print' : 'View'}
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
