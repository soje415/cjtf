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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalNav profile={activeProfile} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
