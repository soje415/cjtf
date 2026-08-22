import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { canRegister } from '@/lib/roles'

// Staff-only gate for the registration entry. The public registration form is
// gone: clicking "Apply to Join" / "Register Office" lands here, and only an
// ICT/Admin login lets a staff member proceed to register on the public's behalf.
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const mode = formData.get('mode') === 'office' ? 'office' : 'applicant'
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

  const errParams = () => {
    const p = new URLSearchParams({ error: 'Invalid staff credentials.' })
    if (mode === 'office') p.set('role', 'office')
    return p
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/register?${errParams().toString()}`, { status: 303 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!canRegister(profile?.role)) {
    // Correct credentials but the wrong role — refuse and clear the session.
    await supabase.auth.signOut()
    const p = new URLSearchParams({ error: 'Restricted: only ICT or Admin can register applicants.' })
    if (mode === 'office') p.set('role', 'office')
    const res = NextResponse.redirect(`${origin}/auth/register?${p.toString()}`, { status: 303 })
    cookieJar.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.cookies.set(name, value, options as any)
    })
    return res
  }

  const res = NextResponse.redirect(`${origin}/portal/staff/register?mode=${mode}`, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })
  return res
}
