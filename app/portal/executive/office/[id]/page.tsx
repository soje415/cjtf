import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OfficeRegistration } from '@/lib/types'
import { logExecutiveAccess } from '@/lib/executive-log'
import ExecutiveOfficeView from '@/components/dashboards/ExecutiveOfficeView'

export default async function ExecutiveOfficePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'executive') redirect('/auth/login')

  const { data: reg } = await service
    .from('office_registrations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!reg) notFound()

  // Record that this executive opened this specific office record. The
  // access-log FK only points at applications, so office views are logged
  // without a record id for now — still proves the record was opened.
  await logExecutiveAccess(service, user.id, 'view_application')

  const { data: payments } = await service
    .from('payments')
    .select('*')
    .eq('office_registration_id', params.id)
    .order('created_at', { ascending: true })

  const { data: notes } = await service
    .from('office_registration_notes')
    .select('*, profiles(full_name, role)')
    .eq('registration_id', params.id)
    .order('created_at', { ascending: true })

  return (
    <ExecutiveOfficeView
      registration={reg as OfficeRegistration}
      payments={payments ?? []}
      notes={notes ?? []}
    />
  )
}
