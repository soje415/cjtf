import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplicationForm from '@/components/application-form/ApplicationForm'
import { canRegister } from '@/lib/roles'

// "New application" entry: ICT/Admin land here straight from the dashboard and
// fill the form directly — the blank applicant record + DRAFT are created lazily
// on first save (see POST /api/applications). No separate registration step.
export default async function StaffNewApplicationPage({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
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

  const membershipType = searchParams.type === 'legacy' ? 'legacy' : 'new'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">
        New {membershipType === 'legacy' ? 'Legacy Member ' : ''}Application
      </h1>
      <p className="text-sm text-gray-500">
        Fill the application on behalf of the applicant. The record is created as you go.
      </p>
      <ApplicationForm
        existingApplication={null}
        userId={user.id}
        membershipType={membershipType}
        afterSubmitPath={(id) => `/portal/staff/application/${id}`}
      />
    </div>
  )
}
