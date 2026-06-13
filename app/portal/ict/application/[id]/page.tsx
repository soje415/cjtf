import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import IctApplicationReview from '@/components/dashboards/IctApplicationReview'

export default async function IctApplicationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ict') redirect('/auth/login')

  const { data: app } = await service
    .from('applications')
    .select('*')
    .eq('id', params.id)
    .in('status', ['PENDING_ICT_VERIFICATION', 'APPROVED_GENERATING_ID'])
    .maybeSingle()

  if (!app) notFound()

  const { data: payments } = await service
    .from('payments')
    .select('*')
    .eq('application_id', app.id)

  const { data: notes } = await service
    .from('application_notes')
    .select('*, profiles(full_name, role)')
    .eq('application_id', app.id)
    .order('created_at', { ascending: true })

  return (
    <IctApplicationReview
      application={app}
      payments={payments ?? []}
      notes={notes ?? []}
    />
  )
}
