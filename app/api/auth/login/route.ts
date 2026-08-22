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
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  // Registration is now staff-only: applicant/registrant accounts are internal
  // identity anchors only and can never sign in. Sign them back out.
  const role = profile?.role ?? null
  if (!role || role === 'applicant') {
    await supabase.auth.signOut()
    const errParams = new URLSearchParams({ error: 'This account cannot sign in. Only staff may access the portal.' })
    const res = NextResponse.redirect(`${origin}/auth/login?${errParams.toString()}`, { status: 303 })
    cookieJar.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.cookies.set(name, value, options as any)
    })
    return res
  }

  const target = `/portal/${role}/dashboard`
  const res = NextResponse.redirect(`${origin}${target}`, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })

  return res
}
