import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const next = safeNext(formData.get('next') as string | null)
  const role = formData.get('role') === 'office' ? 'office' : null

  if (password !== confirm) {
    const errParams = new URLSearchParams({ error: 'Passwords do not match.' })
    if (next) errParams.set('next', next)
    if (role) errParams.set('role', role)
    return NextResponse.redirect(`${req.nextUrl.origin}/auth/register?${errParams.toString()}`, { status: 303 })
  }

  const origin = req.nextUrl.origin
  const cookieJar: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => { cookieJar.push(...cookies) },
      },
    }
  )

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: 'applicant', phone } },
  })

  if (error) {
    // Preserve office intent through the error redirect — otherwise a failed
    // signup (duplicate email, weak password, etc.) drops the retry back
    // into the recruitment register page/flow instead of office's.
    const errParams = new URLSearchParams({ error: error.message })
    if (next) errParams.set('next', next)
    if (role) errParams.set('role', role)
    return NextResponse.redirect(
      `${origin}/auth/register?${errParams.toString()}`,
      { status: 303 }
    )
  }

  if (data.user) {
    // With email confirmation enabled, a duplicate email returns Supabase's
    // obfuscated user with an empty `identities` array and no session — do not
    // write a profile row for it (the trigger only fires for genuinely new rows).
    const isDuplicate = Array.isArray(data.user.identities) && data.user.identities.length === 0
    if (!isDuplicate) {
      const service = createServiceClient()
      await service.from('profiles').upsert(
        { id: data.user.id, role: 'applicant', full_name: fullName, phone },
        { onConflict: 'id' }
      )
    }
  }

  // Supabase may require email confirmation (Auth → Sign In → Email → "Confirm
  // email"). When it does, signUp returns the user but NO session, so there is
  // nothing to redirect onward to — the portal guards would just bounce them to
  // login anyway. Send them to login with a clear message instead.
  if (data.user && !data.session) {
    const msgParams = new URLSearchParams({
      message: 'Account created. Please check your email and click the confirmation link, then sign in.',
    })
    if (next) msgParams.set('next', next)
    if (role) msgParams.set('role', role)
    const res = NextResponse.redirect(`${origin}/auth/login?${msgParams.toString()}`, { status: 303 })
    cookieJar.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.cookies.set(name, value, options as any)
    })
    return res
  }

  // Office registration is prototyping-stage — skip the phone OTP gate
  // entirely and drop straight into the office flow. Recruitment still
  // requires it. Fall back to the office_intent cookie (set by middleware
  // on any visit to /portal/applicant/office) in case `next`/`role` got
  // dropped along the way in — e.g. the user registered via a link that
  // didn't carry them.
  // role=office (from the login screen's "Register here" link) is a first-class
  // signal too — it must not be dropped, otherwise an office registrant who
  // arrived without a `next`/cookie is dumped into the recruitment OTP gate.
  const isOfficeIntent =
    role === 'office' ||
    next === '/portal/applicant/office' ||
    req.cookies.get('office_intent')?.value === '1'
  const destination = isOfficeIntent
    ? `${origin}/portal/applicant/office`
    : next
      ? `${origin}/portal/applicant/verify-phone?next=${encodeURIComponent(next)}`
      : `${origin}/portal/applicant/verify-phone`
  const res = NextResponse.redirect(destination, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })
  return res
}
