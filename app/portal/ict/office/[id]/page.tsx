import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PermitGenerate from '@/components/certificate/PermitGenerate'

export default async function IctOfficePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ict') redirect('/auth/login')

  const { data: reg } = await service
    .from('office_registrations')
    .select('*')
    .eq('id', params.id)
    .in('status', ['APPROVED_GENERATING_CERT', 'COMPLETED'])
    .maybeSingle()

  if (!reg) notFound()

  const issued = reg.admin_approved_at ?? reg.updated_at
  const dateIssued = issued
    ? new Date(issued).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const fullName = [reg.title, reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(' ')
  const officeAddress = [reg.office_address, reg.district, reg.area_council].filter(Boolean).join(', ')
  const officeName = [reg.office_name, reg.office_designation].filter(Boolean).join(' — ')

  return (
    <PermitGenerate
      registrationId={reg.id}
      fullName={fullName}
      officeAddress={officeAddress}
      officeName={officeName}
      dateIssued={dateIssued}
      initialCertNumber={reg.cert_number ?? null}
      initialPdfUrl={reg.cert_pdf_url ?? null}
    />
  )
}
