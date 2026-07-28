import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string
  const origin = req.nextUrl.origin

  if (!password || password.length < 8 || password !== confirm) {
    return NextResponse.redirect(
      `${origin}/auth/reset-password?error=${encodeURIComponent('Passwords must match and be at least 8 characters.')}`,
      { status: 303 }
    )
  }

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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.redirect(`${origin}/auth/forgot-password`, { status: 303 })
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/reset-password?error=${encodeURIComponent(error.message)}`,
      { status: 303 }
    )
  }

  await supabase.auth.signOut()

  const res = NextResponse.redirect(`${origin}/auth/login?message=Password+updated.+Please+sign+in.`, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })
  return res
}
