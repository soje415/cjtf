import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import OfficeReview from '@/components/dashboards/OfficeReview'

export default async function AdminOfficePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/auth/login')

  const { data: reg } = await service
    .from('office_registrations')
    .select('*')
    .eq('id', params.id)
    .eq('status', 'PENDING_ADMIN_APPROVAL')
    .maybeSingle()

  if (!reg) notFound()

  const { data: notes } = await service
    .from('office_registration_notes')
    .select('*, profiles(full_name, role)')
    .eq('registration_id', reg.id)
    .order('created_at', { ascending: true })

  return <OfficeReview registration={reg} notes={notes ?? []} role="admin" />
}
