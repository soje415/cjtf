import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { safeRedirectPath } from '@/lib/safe-next'

// Exchanges a Supabase auth link's ?code= for a session, then continues to
// `next` (used by the password-reset email link). Cookies must be set on the
// redirect response for the follow-up page to see the new session.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const linkType = searchParams.get('type')
  // Recovery links (password reset) must land on the reset screen even if the
  // `next` param didn't survive; other link types default to the dashboard.
  const next =
    safeRedirectPath(searchParams.get('next')) ??
    (linkType === 'recovery' ? '/auth/reset-password' : '/portal/applicant/dashboard')

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Invalid or expired link.')}`)
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('That link has expired. Please request a new one.')}`)
  }

  const res = NextResponse.redirect(`${origin}${next}`, { status: 303 })
  cookieJar.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(name, value, options as any)
  })
  return res
}
