import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OfficeVirtualAccountPayment from '@/components/office-form/OfficeVirtualAccountPayment'

export default async function OfficePaymentPage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: reg } = await service
    .from('office_registrations')
    .select('id, status, first_name, last_name, office_name')
    .eq('registrant_id', user.id)
    .eq('status', 'PENDING_PAYMENT')
    .maybeSingle()

  if (!reg) redirect('/portal/applicant/office')

  return (
    <OfficeVirtualAccountPayment
      registrationId={reg.id}
      name={`${reg.first_name} ${reg.last_name}`}
      officeName={reg.office_name}
    />
  )
}
