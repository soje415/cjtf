import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'
import { generateOtp, hashOtp, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from '@/lib/otp'

export async function POST() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('phone, phone_verified')
    .eq('id', user.id)
    .single()

  if (!profile?.phone) {
    return NextResponse.json({ error: 'No phone number on file for your account.' }, { status: 400 })
  }
  if (profile.phone_verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }

  // Resend cooldown
  const { data: existing } = await service
    .from('phone_otps')
    .select('last_sent_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const elapsed = Date.now() - new Date(existing.last_sent_at).getTime()
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000)
      return NextResponse.json({ error: `Please wait ${wait}s before requesting another code.` }, { status: 429 })
    }
  }

  const code = generateOtp()
  const now = new Date()
  await service.from('phone_otps').upsert(
    {
      user_id: user.id,
      phone: profile.phone,
      code_hash: hashOtp(code, user.id),
      expires_at: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      last_sent_at: now.toISOString(),
    },
    { onConflict: 'user_id' }
  )

  await sendSms(
    profile.phone,
    `Your CJTF verification code is ${code}. It expires in 10 minutes. Do not share it.`
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
