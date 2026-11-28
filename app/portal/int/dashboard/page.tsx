import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Clock, CheckCircle2, MapPin } from 'lucide-react'
import { StatCards, Stat } from '@/components/dashboards/StaffUI'
import OfficeRequestsPanel from '@/components/dashboards/OfficeRequestsPanel'
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

  const stats: Stat[] = [
    { label: 'Total Applications', value: submitted.length, icon: Users, tone: 'blue' },
    { label: 'Pending Screening', value: apps.length, icon: Clock, tone: 'red' },
    { label: 'Successfully Screened', value: screened, icon: CheckCircle2, tone: 'green' },
    { label: states === 1 ? 'State' : 'States', value: states, icon: MapPin, tone: 'violet' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900 lg:sr-only">Intelligence Screening Dashboard</h1>

      <StatCards stats={stats} />

      <ScreeningQueue rows={rows} sectors={sectors} />

      <OfficeRequestsPanel
        title="Office Registration Requests" offices={offices} hrefBase="/portal/int/office"
        action="Screen" empty="No office requests pending screening."
      />
    </div>
  )
}
