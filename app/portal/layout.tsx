import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortalNav from '@/components/dashboards/PortalNav'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const service = createServiceClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  // Use service role to bypass broken RLS on profiles
  const { data: profile } = await service
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  const activeProfile = profile ?? await (async () => {
    await service.from('profiles').upsert({
      id: session.user.id,
      role: session.user.user_metadata?.role ?? 'applicant',
      full_name: session.user.user_metadata?.full_name ?? session.user.email ?? '',
    }, { onConflict: 'id' })
    const { data } = await service.from('profiles').select('*').eq('id', session.user.id).single()
    return data
  })()

  if (!activeProfile) redirect('/auth/login')

  // Office registrants and recruitment applicants share the same
  // `applicant` role, but need different nav links — figure out which
  // flow(s) this user actually has a registration in.
  let hasOfficeReg = false
  let hasApplication = false
  if (activeProfile.role === 'applicant') {
    const [{ data: officeReg }, { data: application }] = await Promise.all([
      service.from('office_registrations').select('id').eq('registrant_id', session.user.id).limit(1).maybeSingle(),
      service.from('applications').select('id').eq('applicant_id', session.user.id).limit(1).maybeSingle(),
    ])
    hasOfficeReg = !!officeReg
    hasApplication = !!application
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalNav profile={activeProfile} hasOfficeReg={hasOfficeReg} hasApplication={hasApplication} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
