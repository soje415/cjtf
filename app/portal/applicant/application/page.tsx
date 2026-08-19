import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplicationForm from '@/components/application-form/ApplicationForm'
import MembershipTypeChoice from '@/components/application-form/MembershipTypeChoice'

export default async function ApplicationPage({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
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

  // Membership type is chosen once, before any row exists, then rides along
  // on the application itself. If one already exists it already carries the
  // answer — no need to ask again.
  if (!latest && searchParams.type !== 'new' && searchParams.type !== 'legacy') {
    return <MembershipTypeChoice />
  }

  const membershipType = latest?.membership_type ?? (searchParams.type === 'legacy' ? 'legacy' : 'new')

  return <ApplicationForm existingApplication={latest} userId={user.id} membershipType={membershipType} />
}
