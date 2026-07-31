import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Public routes — always accessible
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/paystack/webhook') ||
    pathname.startsWith('/api/hyparrow/webhook') ||
    pathname.startsWith('/verify') ||
    pathname === '/' ||
    pathname.startsWith('/about')
  ) {
    return supabaseResponse
  }

  // Any touch of the office flow tags this browser with a durable cookie —
  // query params (`next`/`role`) get dropped whenever a user re-enters
  // through a link that doesn't carry them (e.g. the homepage's generic
  // "Start Your Application" CTA, or a bare bookmarked /auth/register),
  // which used to silently bounce them into the recruitment OTP path.
  // The cookie survives that and lets register/verify-phone recover intent.
  const isOfficePath = pathname.startsWith('/portal/applicant/office')
  if (isOfficePath) {
    supabaseResponse.cookies.set('office_intent', '1', {
      path: '/',
      maxAge: 60 * 60,
      sameSite: 'lax',
    })
  }

  // Must be logged in for portal
  if (!session) {
    const originalPath = pathname
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = ''
    url.searchParams.set('next', originalPath)
    if (isOfficePath) {
      url.searchParams.set('role', 'office')
    }
    const res = NextResponse.redirect(url)
    if (isOfficePath) {
      res.cookies.set('office_intent', '1', { path: '/', maxAge: 60 * 60, sameSite: 'lax' })
    }
    return res
  }

  // Use service role to bypass RLS recursion on profiles table
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const role = profile?.role ?? 'applicant'

  // Enforce RBAC — redirect to correct dashboard if visiting wrong area
  if (pathname.startsWith('/portal/applicant') && role !== 'applicant') {
    return NextResponse.redirect(new URL(`/portal/${role}/dashboard`, request.url))
  }
  if (pathname.startsWith('/portal/ict') && role !== 'ict') {
    return NextResponse.redirect(new URL(`/portal/${role}/dashboard`, request.url))
  }
  if (pathname.startsWith('/portal/int') && role !== 'int') {
    return NextResponse.redirect(new URL(`/portal/${role}/dashboard`, request.url))
  }
  if (pathname.startsWith('/portal/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL(`/portal/${role}/dashboard`, request.url))
  }
  if (pathname.startsWith('/portal/executive') && role !== 'executive') {
    return NextResponse.redirect(new URL(`/portal/${role}/dashboard`, request.url))
  }

  // Redirect /portal root to role dashboard
  if (pathname === '/portal') {
    return NextResponse.redirect(new URL(`/portal/${role}/dashboard`, request.url))
  }

  return supabaseResponse
}
