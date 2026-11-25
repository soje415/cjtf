import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { normalizeSectorName } from '@/lib/sectors'
import BatchActions from '@/components/dashboards/BatchActions'
import { ACTION_LABELS, BATCH_STATUS_LABELS, BATCH_STATUS_COLORS, canViewBatches, PrintBatch, PrintAction } from '@/lib/print-batches'

const PRINT_LABEL: Record<string, string> = { not_queued: 'Not queued', queued: 'Queued', printed: 'Printed', collected: 'Collected' }

export default async function PrintBatchDetail({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role as string | undefined
  if (!canViewBatches(role)) redirect('/auth/login')

  const { data: batchRow } = await service.from('print_batches').select('*').eq('id', params.id).maybeSingle()
  if (!batchRow) notFound()
  const batch = batchRow as PrintBatch

  const { data: itemRows } = await service.from('print_batch_items').select('application_id').eq('batch_id', batch.id)
  const appIds = (itemRows ?? []).map((i) => i.application_id as string)
  const { data: apps } = appIds.length
    ? await service
        .from('applications')
        .select('id, first_name, last_name, cjtf_id_number, unit, status, print_status, id_card_pdf_url')
        .in('id', appIds)
        .order('last_name', { ascending: true })
    : { data: [] as { id: string; first_name: string; last_name: string; cjtf_id_number: string | null; unit: string | null; status: string; print_status: string; id_card_pdf_url: string | null }[] }

  const { data: eventRows } = await service
    .from('print_events').select('*').eq('batch_id', batch.id).order('created_at', { ascending: true })
  const events = (eventRows ?? []) as { id: string; actor_id: string | null; actor_role: string | null; action: PrintAction; note: string | null; created_at: string }[]
  const actorIds = [...new Set(events.map((e) => e.actor_id).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (actorIds.length) {
    const { data: ps } = await service.from('profiles').select('id, full_name').in('id', actorIds)
    for (const p of ps ?? []) names.set(p.id, p.full_name)
  }

  const cards = apps ?? []
  const cardUrls = cards.map((a) => a.id_card_pdf_url).filter(Boolean) as string[]
  // A card counts as generated once the applicant is COMPLETED with a saved card file.
  const isGenerated = (a: { status: string; id_card_pdf_url: string | null }) => a.status === 'COMPLETED' && !!a.id_card_pdf_url
  const generatedCount = cards.filter(isGenerated).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">{batch.batch_no}</p>
          <h1 className="text-2xl font-bold text-gray-800">{batch.sector_command} <span className="text-gray-400">/</span> {batch.sub_sector}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <Badge className={BATCH_STATUS_COLORS[batch.status]}>{BATCH_STATUS_LABELS[batch.status]}</Badge>
            <span>{batch.card_count} applicant(s)</span>
            {batch.status !== 'with_admin' && batch.status !== 'cancelled' && <span>· {generatedCount} / {cards.length} IDs generated</span>}
            <span>· created {new Date(batch.created_at).toLocaleString('en-NG')}</span>
          </div>
          {batch.note && <p className="mt-2 text-sm text-gray-700 bg-gray-50 border rounded px-3 py-2">Note: {batch.note}</p>}
        </div>
        <LinkButton href="/portal/staff/print" variant="outline" size="sm">← All batches</LinkButton>
      </div>

      <BatchActions
        batchId={batch.id}
        batchNo={batch.batch_no}
        status={batch.status}
        role={role as string}
        cardUrls={cardUrls}
        cardCount={cards.length}
        generatedCount={generatedCount}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Applicants in this batch</CardTitle></CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              {batch.status === 'cancelled' ? 'This batch was cancelled; its applicants were released back to the queue.' : 'No applicants.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase">
                    <th className="text-left pb-2 pr-4">Name</th>
                    <th className="text-left pb-2 pr-4">CJTF ID</th>
                    <th className="text-left pb-2 pr-4">Unit</th>
                    <th className="text-left pb-2 pr-4">ID card</th>
                    <th className="text-left pb-2">Print status</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium">
                        {role === 'ict' && batch.status === 'with_ict' ? (
                          <Link href={`/portal/ict/application/${a.id}`} className="text-cjtf-green hover:underline">{a.first_name} {a.last_name}</Link>
                        ) : (
                          <>{a.first_name} {a.last_name}</>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-600">{a.cjtf_id_number ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-gray-600">{normalizeSectorName(a.unit) || '—'}</td>
                      <td className="py-1.5 pr-4">
                        {isGenerated(a)
                          ? <span className="text-xs text-green-700">Generated</span>
                          : a.status === 'COMPLETED'
                            ? role === 'ict'
                              ? <Link href={`/portal/ict/application/${a.id}`} className="text-xs text-red-700 underline">ID assigned, card not saved. Re-save →</Link>
                              : <span className="text-xs text-red-700">ID assigned, card not saved</span>
                            : role === 'ict' && batch.status === 'with_ict'
                              ? <Link href={`/portal/ict/application/${a.id}`} className="text-xs text-amber-700 underline">Generate →</Link>
                              : <span className="text-xs text-amber-700">Awaiting generation</span>}
                      </td>
                      <td className="py-1.5 text-gray-600">{PRINT_LABEL[a.print_status] ?? a.print_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="border-b last:border-0 pb-2 text-sm">
              <p className="font-medium text-gray-800">{ACTION_LABELS[e.action] ?? e.action}</p>
              <p className="text-xs text-gray-500">
                {(e.actor_id && names.get(e.actor_id)) || 'Unknown'}{e.actor_role ? ` (${e.actor_role.toUpperCase()})` : ''} · {new Date(e.created_at).toLocaleString('en-NG')}
              </p>
              {e.note && <p className="text-sm text-gray-600 mt-0.5">{e.note}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
