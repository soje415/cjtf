import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IdCardDownload from '@/components/id-card/IdCardDownload'
import { rankForCard } from '@/lib/ranks'
import { memberVerifyUrl } from '@/lib/portal-url'

export default async function IdCardPage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: app } = await service
    .from('applications')
    .select('*')
    .eq('applicant_id', user.id)
    .eq('status', 'COMPLETED')
    .maybeSingle()

  if (!app) redirect('/portal/applicant/dashboard')

  const completedAt = app.completed_at ?? app.created_at
  const issueDate = completedAt
    ? new Date(completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const dateOfBirth = app.date_of_birth
    ? new Date(app.date_of_birth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  const verifyUrl = memberVerifyUrl(app.id)

  return (
    <IdCardDownload
      fullName={[app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ')}
      cjtfId={app.cjtf_id_number ?? ''}
      stateOfOrigin={app.state_of_origin ?? ''}
      lga={app.lga_of_origin ?? ''}
      dateOfBirth={dateOfBirth}
      gender={app.gender ?? ''}
      nin={app.nin ?? undefined}
      bloodGroup={app.blood_group ?? undefined}
      designation={rankForCard(app.cjtf_rank)}
      issueDate={issueDate}
      photoUrl={app.passport_photo_url ?? ''}
      pdfUrl={app.id_card_pdf_url ?? ''}
      verifyUrl={verifyUrl}
    />
  )
}
