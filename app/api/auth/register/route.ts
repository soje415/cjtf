import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const next = safeNext(formData.get('next') as string | null)
  const role = formData.get('role') === 'office' ? 'office' : null

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
    const service = createServiceClient()
    await service.from('profiles').upsert(
      { id: data.user.id, role: 'applicant', full_name: fullName, phone },
      { onConflict: 'id' }
    )
  }

  // Office registration is prototyping-stage — skip the phone OTP gate
  // entirely and drop straight into the office flow. Recruitment still
  // requires it. Fall back to the office_intent cookie (set by middleware
  // on any visit to /portal/applicant/office) in case `next`/`role` got
  // dropped along the way in — e.g. the user registered via a link that
  // didn't carry them.
  const isOfficeIntent = next === '/portal/applicant/office' || req.cookies.get('office_intent')?.value === '1'
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
