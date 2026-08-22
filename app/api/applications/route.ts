import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { canRegister } from '@/lib/roles'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const body = await req.json().catch(() => ({}))
  const membershipType = body?.membershipType === 'legacy' ? 'legacy' : 'new'

  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // ICT/Admin create the blank applicant identity + DRAFT in one step — the
  // real name/email/phone are filled in the form afterwards. The applicant has
  // no login (random, never-shared credentials).
  if (canRegister(callerProfile?.role)) {
    const email = `applicant-${randomUUID()}@cjtf.internal`
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { role: 'applicant' },
    })
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message ?? 'Could not create the applicant record.' }, { status: 500 })
    }
    await service.from('profiles').upsert(
      { id: created.user.id, role: 'applicant', full_name: '' },
      { onConflict: 'id' }
    )
    const { data, error } = await service
      .from('applications')
      .insert({ applicant_id: created.user.id, status: 'DRAFT', email, membership_type: membershipType })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ application: data }, { status: 201 })
  }

  // Check for existing non-rejected application
  const { data: existing } = await service
    .from('applications')
    .select('id, status')
    .eq('applicant_id', user.id)
    .not('status', 'eq', 'REJECTED')
    .maybeSingle()

  if (existing) return NextResponse.json({ application: existing })

  const { data, error } = await service
    .from('applications')
    .insert({ applicant_id: user.id, status: 'DRAFT', email: user.email, membership_type: membershipType })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ application: data }, { status: 201 })
}

export async function GET() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  let query = service.from('applications').select('*, profiles!applications_applicant_id_fkey(full_name, phone)')

  if (profile?.role === 'applicant') {
    query = query.eq('applicant_id', user.id)
  } else if (profile?.role === 'ict') {
    query = query.in('status', ['PENDING_ICT_VERIFICATION', 'APPROVED_GENERATING_ID'])
  } else if (profile?.role === 'int') {
    query = query.eq('status', 'PENDING_INT_SCREENING')
  } else if (profile?.role === 'admin') {
    query = query.eq('status', 'PENDING_ADMIN_APPROVAL')
  } else {
    // Unknown/null role (or missing profile row): deny by default rather than
    // returning the whole unfiltered table of PII.
    return NextResponse.json({ applications: [] })
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ applications: data })
}
