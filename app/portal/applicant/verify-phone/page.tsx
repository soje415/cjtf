import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import VerifyPhoneForm from '@/components/dashboards/VerifyPhoneForm'
import { safeNext } from '@/lib/safe-next'

export default async function VerifyPhonePage({ searchParams }: { searchParams: { next?: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  // Fall back to the office_intent cookie when `next` didn't survive the
  // redirect chain — otherwise an office registrant who ends up on this
  // (recruitment-only) OTP gate gets dropped into the recruitment dashboard.
  const officeIntentCookie = cookies().get('office_intent')?.value === '1'
  const next = safeNext(searchParams.next) ?? (officeIntentCookie ? '/portal/applicant/office' : null)

  const { data: profile } = await service
    .from('profiles')
    .select('phone, phone_verified, role')
    .eq('id', user.id)
    .single()

  // Only applicants need phone verification; staff skip it.
  if (profile && profile.role !== 'applicant') redirect(`/portal/${profile.role}/dashboard`)
  if (profile?.phone_verified) redirect(next ?? '/portal/applicant/dashboard')

  // Mask the phone for display (e.g. 0801****678)
  const phone = profile?.phone ?? ''
  const masked = phone.length >= 7 ? `${phone.slice(0, 4)}****${phone.slice(-3)}` : phone

  return <VerifyPhoneForm maskedPhone={masked} hasPhone={!!phone} next={next} />
}
