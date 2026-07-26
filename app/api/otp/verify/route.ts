import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hashOtp, OTP_MAX_ATTEMPTS } from '@/lib/otp'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  const clean = String(code ?? '').trim()
  if (!/^\d{6}$/.test(clean)) {
    return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: row } = await service
    .from('phone_otps')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'No code on file. Request a new one.' }, { status: 400 })
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await service.from('phone_otps').delete().eq('user_id', user.id)
    return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 })
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await service.from('phone_otps').delete().eq('user_id', user.id)
    return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 400 })
  }

  if (hashOtp(clean, user.id) !== row.code_hash) {
    await service.from('phone_otps').update({ attempts: row.attempts + 1 }).eq('user_id', user.id)
    const left = OTP_MAX_ATTEMPTS - row.attempts - 1
    return NextResponse.json(
      { error: `Incorrect code.${left > 0 ? ` ${left} attempt${left === 1 ? '' : 's'} left.` : ' Request a new code.'}` },
      { status: 400 }
    )
  }

  // Verified
  await service.from('profiles').update({ phone_verified: true }).eq('id', user.id)
  await service.from('phone_otps').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
