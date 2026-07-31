import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = safeNext(formData.get('next') as string | null)
  const ROLE_PICKER_KEYS = ['applicant', 'ict', 'int', 'admin', 'executive', 'office']
  const roleParam = formData.get('role') as string | null
  const submittedRole = roleParam && ROLE_PICKER_KEYS.includes(roleParam) ? roleParam : null

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
    // Preserve which role screen (and `next` destination) the user was on —
    // otherwise a wrong password bounces an office/applicant login attempt
    // back to the generic role picker and loses its destination.
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
    .single()

  const role = profile?.role ?? 'applicant'
  // Fall back to the office_intent cookie (set by middleware on any visit to
  // /portal/applicant/office) when `next` didn't survive the redirect chain.
  const officeIntent = next ?? (req.cookies.get('office_intent')?.value === '1' ? '/portal/applicant/office' : null)
  const target = role === 'applicant' && officeIntent ? officeIntent : `/portal/${role}/dashboard`

  const res = NextResponse.redirect(`${origin}${target}`, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })

  return res
}
