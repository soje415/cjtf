import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, IdCard, Wallet, Building2, UserPlus, FilePen } from 'lucide-react'
import { LinkButton } from '@/components/ui/link-button'
import IctQueues, { IctRow } from '@/components/dashboards/IctQueues'
import OfficeRequestsPanel from '@/components/dashboards/OfficeRequestsPanel'
import { Panel, Pill, StatCards, Stat, headRow, rowButton, table, td, th, tr } from '@/components/dashboards/StaffUI'
import { buildSectorOptions } from '@/lib/sector-options'
import { STATUS_LABELS, MEMBERSHIP_TYPE_LABELS, OFFICE_STATUS_LABELS, Application, OfficeRegistration } from '@/lib/types'

export default async function IctDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ict') redirect('/auth/login')

  const { data: pending } = await service
    .from('applications')
    .select('*, profiles!applications_applicant_id_fkey(full_name)')
    .eq('status', 'PENDING_ICT_VERIFICATION')
    .order('submitted_at', { ascending: true })

  const { data: generating } = await service
    .from('applications')
    .select('*, profiles!applications_applicant_id_fkey(full_name)')
    .eq('status', 'APPROVED_GENERATING_ID')
    .order('admin_approved_at', { ascending: true })

  const apps = pending as Application[] ?? []
  const idApps = generating as Application[] ?? []

  // Office permits awaiting ICT generation/printing (after Admin approval)
  const { data: officeRows } = await service
    .from('office_registrations')
    .select('id, office_name, first_name, last_name, area_council, district, cert_number, admin_approved_at')
    .eq('status', 'APPROVED_GENERATING_CERT')
    .order('admin_approved_at', { ascending: true })
  const officePermits = officeRows ?? []

  // In-progress drafts ICT started but hasn't submitted yet — quick resume.
  const { data: draftRows } = await service
    .from('applications')
    .select('*')
    .in('status', ['DRAFT', 'REJECTED'])
    .order('updated_at', { ascending: false })
    .limit(20)
  const drafts = (draftRows ?? []) as Application[]

  const { data: officeDraftRows } = await service
    .from('office_registrations')
    .select('*')
    .in('status', ['DRAFT', 'REJECTED'])
    .order('updated_at', { ascending: false })
    .limit(20)
  const officeDrafts = (officeDraftRows ?? []) as OfficeRegistration[]

  // Awaiting payment — ICT collects the fee here ("I have paid" / bank transfer).
  const { data: paymentRows } = await service
    .from('applications')
    .select('*')
    .eq('status', 'PENDING_PAYMENT')
    .order('submitted_at', { ascending: true })
  const pendingPayment = (paymentRows ?? []) as Application[]

  const { data: officePaymentRows } = await service
    .from('office_registrations')
    .select('*')
    .eq('status', 'PENDING_PAYMENT')
    .order('submitted_at', { ascending: true })
  const pendingPaymentOffices = (officePaymentRows ?? []) as OfficeRegistration[]

  const toRow = (app: Application): IctRow => ({
    id: app.id,
    name: `${app.first_name} ${app.last_name}`.trim(),
    membershipType: app.membership_type,
    origin: [app.state_of_origin, app.lga_of_origin].filter(Boolean).join(' / ') || '—',
    sectorCommand: app.sector_command,
    subSector: app.sub_sector,
    rank: app.cjtf_rank,
    submittedOn: app.submitted_at
      ? new Date(app.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
      : '—',
  })
  const queued = [...apps, ...idApps]

  const stats: Stat[] = [
    { label: 'Pending Verification', value: apps.length, icon: ShieldCheck, tone: 'blue' },
    { label: 'Ready for ID Generation', value: idApps.length, icon: IdCard, tone: 'green' },
    { label: 'Awaiting Payment', value: pendingPayment.length + pendingPaymentOffices.length, icon: Wallet, tone: 'amber' },
    { label: 'Office Permits', value: officePermits.length, icon: Building2, tone: 'violet' },
  ]

  const payments: RecordRow[] = [
    ...pendingPayment.map((p) => ({
      id: p.id, name: `${p.first_name} ${p.last_name}`,
      detail: `Applicant · ${MEMBERSHIP_TYPE_LABELS[p.membership_type]}`,
      status: STATUS_LABELS[p.status], href: `/portal/staff/application/${p.id}`,
    })),
    ...pendingPaymentOffices.map((o) => ({
      id: o.id, name: o.office_name || '—',
      detail: `Office · ${o.first_name} ${o.last_name}`,
      status: OFFICE_STATUS_LABELS[o.status], href: `/portal/staff/office/${o.id}`,
    })),
  ]
  const unfinished: RecordRow[] = [
    ...drafts.map((d) => ({
      id: d.id, name: `${d.first_name || '—'} ${d.last_name || ''}`,
      detail: `Applicant · ${MEMBERSHIP_TYPE_LABELS[d.membership_type]}`,
      status: STATUS_LABELS[d.status], href: `/portal/staff/application/${d.id}`,
    })),
    ...officeDrafts.map((o) => ({
      id: o.id, name: o.office_name || '—',
      detail: `Office · ${o.first_name} ${o.last_name}`,
      status: OFFICE_STATUS_LABELS[o.status], href: `/portal/staff/office/${o.id}`,
    })),
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900 lg:sr-only">ICT Processing Dashboard</h1>

      <StatCards stats={stats} />

      <Panel title="Register" icon={UserPlus} bodyClassName="flex flex-wrap gap-3 p-4">
        <LinkButton href="/portal/staff/application/new?type=new" className="h-10 bg-blue-600 px-4 text-white hover:bg-blue-700">
          + New Applicant
        </LinkButton>
        <LinkButton href="/portal/staff/application/new?type=legacy" variant="outline" className="h-10 border-blue-600 px-4 text-blue-700 hover:bg-blue-50">
          + New Legacy Member
        </LinkButton>
        <LinkButton href="/portal/staff/office/new" variant="outline" className="h-10 border-blue-600 px-4 text-blue-700 hover:bg-blue-50">
          + New Office Registration
        </LinkButton>
      </Panel>

      <IctQueues verification={apps.map(toRow)} generation={idApps.map(toRow)} sectors={buildSectorOptions(queued, queued)} />

      {payments.length > 0 && (
        <RecordsPanel title="Awaiting Payment" icon={Wallet} rows={payments} action="Collect Payment" tone="amber" />
      )}

      {/* Office permits to generate + print (handed off by Admin) */}
      <OfficeRequestsPanel
        title="Office Permits to Issue" offices={officePermits} hrefBase="/portal/ict/office"
        action="Generate & Print" empty="No office permits awaiting issuance."
      />

      {unfinished.length > 0 && (
        <RecordsPanel title="In-progress Drafts" icon={FilePen} rows={unfinished} action="Continue" tone="slate" />
      )}
    </div>
  )
}

interface RecordRow { id: string; name: string; detail: string; status: string; href: string }

function RecordsPanel({ title, icon, rows, action, tone }: {
  title: string
  icon: typeof Wallet
  rows: RecordRow[]
  action: string
  tone: 'amber' | 'slate'
}) {
  return (
    <Panel title={title} icon={icon} aside={`${rows.length} record(s)`}>
      <div className="overflow-x-auto">
        <table className={table}>
          <thead>
            <tr className={headRow}>
              <th className={th}>S/N</th>
              <th className={th}>Name</th>
              <th className={th}>Type</th>
              <th className={th}>Status</th>
              <th className={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={tr}>
                <td className={`${td} text-slate-500`}>{i + 1}</td>
                <td className={`${td} font-semibold text-slate-900`}>{r.name}</td>
                <td className={td}>{r.detail}</td>
                <td className={td}><Pill tone={tone}>{r.status}</Pill></td>
                <td className={td}><Link href={r.href} className={rowButton}>{action}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
