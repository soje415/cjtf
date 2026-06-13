import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplicationForm from '@/components/application-form/ApplicationForm'

export default async function ApplicationPage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  // If a non-draft application already exists, send to dashboard
  const { data: submittedApp } = await service
    .from('applications')
    .select('status')
    .eq('applicant_id', user.id)
    .not('status', 'eq', 'DRAFT')
    .limit(1)
    .maybeSingle()

  if (submittedApp) redirect('/portal/applicant/dashboard')

  const { data: app } = await service
    .from('applications')
    .select('*')
    .eq('applicant_id', user.id)
    .eq('status', 'DRAFT')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return <ApplicationForm existingApplication={app} userId={user.id} />
}
