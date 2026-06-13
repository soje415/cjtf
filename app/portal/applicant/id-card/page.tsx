import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IdCardDownload from '@/components/id-card/IdCardDownload'

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

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${app.id}`

  return (
    <IdCardDownload
      fullName={[app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ')}
      cjtfId={app.cjtf_id_number ?? ''}
      stateOfOrigin={app.state_of_origin ?? ''}
      lga={app.lga_of_origin ?? ''}
      dateOfBirth={dateOfBirth}
      gender={app.gender ?? ''}
      nin={app.nin ?? undefined}
      designation="VOLUNTEER MEMBER"
      issueDate={issueDate}
      photoUrl={app.passport_photo_url ?? ''}
      pdfUrl={app.id_card_pdf_url ?? ''}
      verifyUrl={verifyUrl}
    />
  )
}
