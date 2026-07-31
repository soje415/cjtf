import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PermitDownload from '@/components/certificate/PermitDownload'

export default async function CertificatePage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  // Permits are generated/printed by the ICT section. The registrant can only
  // download once the permit has been issued (status COMPLETED).
  const { data: reg } = await service
    .from('office_registrations')
    .select('*')
    .eq('registrant_id', user.id)
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (!reg) redirect('/portal/applicant/office')

  const issued = reg.completed_at ?? reg.admin_approved_at ?? reg.updated_at
  const dateIssued = issued
    ? new Date(issued).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const fullName = [reg.title, reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(' ')
  const officeAddress = [reg.office_address, reg.district, reg.area_council].filter(Boolean).join(', ')
  const officeName = [reg.office_name, reg.office_designation].filter(Boolean).join(' — ')

  return (
    <PermitDownload
      registrationId={reg.id}
      initialPdfUrl={reg.cert_pdf_url ?? null}
      permit={{
        fullName,
        officeAddress,
        officeName,
        permitNumber: reg.cert_number ?? '—',
        dateIssued,
      }}
    />
  )
}
