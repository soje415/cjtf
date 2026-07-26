import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VirtualAccountPayment from '@/components/dashboards/VirtualAccountPayment'

export default async function PaymentPage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: app } = await service
    .from('applications')
    .select('id, status, first_name, last_name')
    .eq('applicant_id', user.id)
    .maybeSingle()

  if (!app || app.status !== 'PENDING_PAYMENT') {
    redirect('/portal/applicant/dashboard')
  }

  return (
    <VirtualAccountPayment
      applicationId={app.id}
      name={`${app.first_name} ${app.last_name}`}
    />
  )
}
