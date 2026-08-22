import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplicationForm from '@/components/application-form/ApplicationForm'
import VirtualAccountPayment from '@/components/dashboards/VirtualAccountPayment'
import OpayUssdPayment from '@/components/dashboards/OpayUssdPayment'
import MarkPaidButton from '@/components/dashboards/MarkPaidButton'
import { canRegister } from '@/lib/roles'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS, Application } from '@/lib/types'

// Staff fill-on-behalf page: ICT/Admin completes an applicant's application that
// has no login of its own, then collects payment and hands the record through
// the review pipeline.
export default async function StaffApplicationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!canRegister(profile?.role)) redirect('/auth/login')

  const { data: appData } = await service
    .from('applications')
    .select('*')
    .eq('id', params.id)
    .single()
  const app = appData as Application | null
  if (!app) redirect('/portal/ict/dashboard')

  const editable = app.status === 'DRAFT' || app.status === 'REJECTED'
  const awaitingPayment = app.status === 'PENDING_PAYMENT'

  if (editable) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Complete Application</h1>
          <Badge className={STATUS_COLORS[app.status]}>{STATUS_LABELS[app.status]}</Badge>
        </div>
        <p className="text-sm text-gray-500">
          Filling on behalf of <strong>{app.first_name || 'applicant'}</strong> · {app.email}
        </p>
        <ApplicationForm
          existingApplication={app}
          userId={app.applicant_id}
          membershipType={app.membership_type}
          onBehalf
        />
      </div>
    )
  }

  if (awaitingPayment) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Collect Payment</h1>
          <p className="text-gray-500 text-sm mt-1">
            Share these payment details with {app.first_name} {app.last_name}. The record advances automatically once the transfer lands.
          </p>
        </div>
        <VirtualAccountPayment
          applicationId={app.id}
          name={`${app.first_name} ${app.last_name}`}
          redirectPath={`/portal/staff/application/${app.id}`}
        />
        <OpayUssdPayment applicationId={app.id} redirectPath={`/portal/staff/application/${app.id}`} />
        <MarkPaidButton applicationId={app.id} redirectPath={`/portal/staff/application/${app.id}`} />
      </div>
    )
  }

  // Past payment → handled by the ICT review queue.
  redirect('/portal/ict/dashboard')
}
