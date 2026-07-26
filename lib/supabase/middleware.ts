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

  // Must be logged in for portal
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
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
