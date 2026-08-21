import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VerifyPhoneForm from '@/components/dashboards/VerifyPhoneForm'
import { safeNext } from '@/lib/safe-next'

export default async function VerifyPhonePage({ searchParams }: { searchParams: { next?: string } }) {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  // This is the recruitment-only OTP gate; office registrants are routed
  // straight to the office flow and never land here, so only `next` matters.
  const next = safeNext(searchParams.next) ?? null

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
