import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PaymentClient from '@/components/dashboards/PaymentClient'

export default async function PaymentPage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: app } = await service
    .from('applications')
    .select('id, status, email, first_name, last_name')
    .eq('applicant_id', user.id)
    .maybeSingle()

  if (!app || app.status !== 'PENDING_PAYMENT') {
    redirect('/portal/applicant/dashboard')
  }

  const { data: payments } = await service
    .from('payments')
    .select('*')
    .eq('application_id', app.id)

  const idCardPaid = payments?.some((p) => p.type === 'id_card' && p.status === 'success')
  const trainingPaid = payments?.some((p) => p.type === 'training' && p.status === 'success')

  return (
    <PaymentClient
      applicationId={app.id}
      email={app.email || user.email || ''}
      name={`${app.first_name} ${app.last_name}`}
      idCardPaid={!!idCardPaid}
      trainingPaid={!!trainingPaid}
    />
  )
}
