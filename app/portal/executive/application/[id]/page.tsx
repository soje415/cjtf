import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Application, Payment, ApplicationNote } from '@/lib/types'
import { logExecutiveAccess } from '@/lib/executive-log'
import ExecutiveApplicationView from '@/components/dashboards/ExecutiveApplicationView'

export default async function ExecutiveApplicationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'executive') redirect('/auth/login')

  const { data: app } = await service
    .from('applications')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!app) notFound()

  // Record that this executive opened this specific applicant record
  await logExecutiveAccess(service, user.id, 'view_application', params.id)

  const { data: payments } = await service
    .from('payments')
    .select('*')
    .eq('application_id', params.id)
    .order('created_at', { ascending: true })

  const { data: notes } = await service
    .from('application_notes')
    .select('*, profiles(full_name, role)')
    .eq('application_id', params.id)
    .order('created_at', { ascending: true })

  return (
    <ExecutiveApplicationView
      application={app as Application}
      payments={(payments as Payment[]) ?? []}
      notes={(notes as (ApplicationNote & { profiles?: { full_name: string; role: string } })[]) ?? []}
    />
  )
}
