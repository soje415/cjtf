import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = safeNext(formData.get('next') as string | null)
  const STAFF_ROLE_KEYS = ['ict', 'int', 'admin', 'executive']
  const roleParam = formData.get('role') as string | null
  const submittedRole = roleParam && STAFF_ROLE_KEYS.includes(roleParam) ? roleParam : null

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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const errParams = new URLSearchParams({ error: error.message })
    if (next) errParams.set('next', next)
    if (submittedRole) errParams.set('role', submittedRole)
    return NextResponse.redirect(
      `${origin}/auth/login?${errParams.toString()}`,
      { status: 303 }
    )
  }

  // Use service role to bypass RLS recursion on profiles table
  const service = createServiceClient()
  const { data: profile, error: profileErr } = await service
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  // Sign back out and return to the login form WITH the role param — the bare
  // role picker doesn't render `?error=`, so without it the message is lost and
  // the user just sees the role cards again. Sign-out cookies must ride along
  // on the response or the session survives.
  const refuse = async (message: string) => {
    await supabase.auth.signOut()
    const errParams = new URLSearchParams({ error: message })
    if (submittedRole) errParams.set('role', submittedRole)
    const res = NextResponse.redirect(`${origin}/auth/login?${errParams.toString()}`, { status: 303 })
    cookieJar.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.cookies.set(name, value, options as any)
    })
    return res
  }

  // A failed lookup is not the same as "not staff" — don't tell a real officer
  // their account is barred because of a transient DB error.
  if (profileErr) {
    console.error('[login] profile lookup failed:', profileErr.message)
    return refuse('Could not verify your account right now. Please try again.')
  }

  // Registration is now staff-only: applicant/registrant accounts are internal
  // identity anchors only and can never sign in.
  const role = profile?.role ?? null
  if (!role || role === 'applicant') {
    // A real officer landing here means their profile row lost (or never got)
    // its staff role — a data problem, not a bad password.
    console.warn(`[login] ${data.user.email} signed in but profile role is "${role}" — refused`)
    return refuse('This account is not set up for staff access. Contact the system administrator.')
  }

  const target = `/portal/${role}/dashboard`
  const res = NextResponse.redirect(`${origin}${target}`, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })

  return res
}
