import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StaffRegisterForm from './StaffRegisterForm'
import { canRegister } from '@/lib/roles'

// Staff registration hub: only ICT/Admin reach this. They create a new
// applicant/office account here, then get routed into that person's form.
export default async function StaffRegisterPage({
  searchParams,
}: {
  searchParams: { mode?: string; type?: string; created?: string }
}) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!canRegister(profile?.role)) redirect(`/portal/${profile?.role ?? 'applicant'}/dashboard`)

  const mode = searchParams.mode === 'office' ? 'office' : 'applicant'
  const justCreated = searchParams.created === '1'
  const initialMembershipType = searchParams.type === 'legacy' ? 'legacy' : 'new'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Staff Registration</h1>
        <p className="text-gray-500 text-sm mt-1">
          Signed in as {profile?.full_name || 'staff'} ·{' '}
          {mode === 'office' ? 'Office registration' : 'Applicant recruitment'}
        </p>
      </div>

      {justCreated && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          Account created and form submitted. You can register another one below.
        </div>
      )}

      <StaffRegisterForm mode={mode} initialMembershipType={initialMembershipType} />

      <p className="text-center text-sm text-gray-400">
        <Link href={`/portal/${profile?.role}/dashboard`} className="hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  )
}
