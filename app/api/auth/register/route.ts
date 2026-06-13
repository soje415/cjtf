import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string

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
    return NextResponse.redirect(
      `${origin}/auth/register?error=${encodeURIComponent(error.message)}`,
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

  const res = NextResponse.redirect(`${origin}/portal/applicant/dashboard`, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })
  return res
}
