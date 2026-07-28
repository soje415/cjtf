import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Always redirects to the same "check your email" state whether or not the
// address is registered — never reveal account existence to the caller.
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = (formData.get('email') as string | null)?.trim()
  const origin = req.nextUrl.origin

  if (email) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    }).catch(() => {})
  }

  return NextResponse.redirect(`${origin}/auth/forgot-password?sent=1`, { status: 303 })
}
