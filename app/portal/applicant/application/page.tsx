import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplicationForm from '@/components/application-form/ApplicationForm'

export default async function ApplicationPage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: latest } = await service
    .from('applications')
    .select('*')
    .eq('applicant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // The form is editable only while DRAFT, or after a rejection (to correct
  // and resubmit). Anything mid-review or completed goes to the dashboard.
  if (latest && latest.status !== 'DRAFT' && latest.status !== 'REJECTED') {
    redirect('/portal/applicant/dashboard')
  }

  return <ApplicationForm existingApplication={latest} userId={user.id} />
}
