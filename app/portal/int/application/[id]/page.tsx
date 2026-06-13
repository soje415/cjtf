import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import IntApplicationReview from '@/components/dashboards/IntApplicationReview'

export default async function IntApplicationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'int') redirect('/auth/login')

  const { data: app } = await service
    .from('applications')
    .select('*')
    .eq('id', params.id)
    .eq('status', 'PENDING_INT_SCREENING')
    .maybeSingle()

  if (!app) notFound()

  const { data: notes } = await service
    .from('application_notes')
    .select('*, profiles(full_name, role)')
    .eq('application_id', app.id)
    .order('created_at', { ascending: true })

  return <IntApplicationReview application={app} notes={notes ?? []} />
}
