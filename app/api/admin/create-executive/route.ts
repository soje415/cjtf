import { NextResponse } from 'next/server'
import { createClient as createSSRClient, createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Admin-only: provision a read-only Executive / DSS oversight account.
export async function POST(req: Request) {
  const supabase = createSSRClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { fullName, email, phone, password } = await req.json()
  if (!fullName?.trim() || !email?.trim() || !password || String(password).length < 8) {
    return NextResponse.json(
      { error: 'Full name, email, and a password of at least 8 characters are required' },
      { status: 400 }
    )
  }

  // Service-role client capable of the GoTrue admin API
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: created, error } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim(), role: 'executive', phone: phone?.trim() ?? '' },
  })

  if (error || !created?.user) {
    return NextResponse.json({ error: error?.message || 'Could not create account' }, { status: 400 })
  }

  // Ensure the profile carries the executive role (the signup trigger defaults
  // role from metadata; upsert to be certain).
  await service.from('profiles').upsert(
    { id: created.user.id, role: 'executive', full_name: fullName.trim(), phone: phone?.trim() || null },
    { onConflict: 'id' }
  )

  return NextResponse.json({ ok: true, id: created.user.id })
}
