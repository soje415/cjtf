import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Clock, CheckCircle2, MapPin } from 'lucide-react'
import { LinkButton } from '@/components/ui/link-button'
import ScreeningQueue, { ScreeningRow } from '@/components/dashboards/ScreeningQueue'
import { buildSectorOptions, SectorPair } from '@/lib/sector-options'
import { fetchAllRows } from '@/lib/fetch-all'
import { heldRank } from '@/lib/ranks'
import { Application } from '@/lib/types'

type Summary = SectorPair & { status: string; int_cleared_at: string | null; state_of_residence: string | null }

const NOT_SUBMITTED = ['DRAFT', 'PENDING_PAYMENT']

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
  const everyone = await fetchAllRows<Summary>((from, to) =>
    service.from('applications').select('status, int_cleared_at, state_of_residence, sector_command, sub_sector').order('id').range(from, to)
  )

  const submitted = everyone.filter((a) => !NOT_SUBMITTED.includes(a.status))
  const screened = submitted.filter((a) => a.int_cleared_at && a.status !== 'REJECTED').length
  const states = new Set(submitted.map((a) => a.state_of_residence?.trim().toLowerCase()).filter(Boolean)).size

  // Drafts are left out so a half-typed sector never shows up in the filter.
  const sectors = buildSectorOptions(submitted, apps)
  const rows: ScreeningRow[] = apps.map((a) => ({
    id: a.id,
    name: `${a.first_name} ${a.last_name}`.trim(),
    state: a.state_of_residence,
    sectorCommand: a.sector_command,
    subSector: a.sub_sector,
    unit: a.unit,
    heldRank: heldRank(a),
    isLegacy: a.membership_type === 'legacy',
    date: a.ict_verified_at
      ? new Date(a.ict_verified_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
      : '—',
  }))

  const { data: officeRows } = await service
    .from('office_registrations')
    .select('id, office_name, first_name, last_name, area_council, district, submitted_at')
    .eq('status', 'PENDING_INT_SCREENING')
    .order('submitted_at', { ascending: true })

  const offices = officeRows ?? []

  const stats = [
    { label: 'Total Applications', value: submitted.length, icon: Users, box: 'bg-blue-100 border-blue-200', dot: 'bg-blue-600', text: 'text-slate-900' },
    { label: 'Pending Screening', value: apps.length, icon: Clock, box: 'bg-red-100 border-red-200', dot: 'bg-red-500', text: 'text-red-600' },
    { label: 'Successfully Screened', value: screened, icon: CheckCircle2, box: 'bg-green-100 border-green-200', dot: 'bg-green-600', text: 'text-slate-900' },
    { label: states === 1 ? 'State' : 'States', value: states, icon: MapPin, box: 'bg-violet-100 border-violet-200', dot: 'bg-violet-600', text: 'text-slate-900' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900 lg:sr-only">Intelligence Screening Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`flex items-center gap-3 rounded-xl border p-4 ${s.box}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${s.dot}`}>
              <s.icon className="h-6 w-6" />
            </span>
            <div>
              <p className={`text-2xl font-extrabold leading-tight ${s.text}`}>{s.value.toLocaleString('en-NG')}</p>
              <p className="text-sm text-slate-700">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <ScreeningQueue rows={rows} sectors={sectors} />

      {/* Office Registration requests for screening */}
      <section className="rounded-xl border bg-white">
        <h2 className="border-b bg-slate-50 px-5 py-3 text-lg font-bold text-slate-900 rounded-t-xl">Office Registration Requests</h2>
        <div className="p-4">
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
        </div>
      </section>
    </div>
  )
}
