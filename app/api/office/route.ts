import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { canRegister } from '@/lib/roles'

// POST: create (or return) the registrant's active office registration draft.
export async function POST() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // ICT/Admin create a blank registrant identity + DRAFT in one step — details
  // are filled in the form afterwards. The registrant has no login.
  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (canRegister(callerProfile?.role)) {
    const email = `office-${randomUUID()}@cjtf.internal`
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { role: 'applicant' },
    })
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message ?? 'Could not create the registrant record.' }, { status: 500 })
    }
    await service.from('profiles').upsert(
      { id: created.user.id, role: 'applicant', full_name: '' },
      { onConflict: 'id' }
    )
    const { data, error } = await service
      .from('office_registrations')
      .insert({ registrant_id: created.user.id, status: 'DRAFT', email })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ registration: data }, { status: 201 })
  }

  // Reuse any existing non-rejected registration. Ordered + limited so a
  // stray duplicate row (e.g. from a double-submit race) can't make this
  // query error out and silently fall through to creating yet another draft.
  const { data: existing } = await service
    .from('office_registrations')
    .select('id, status')
    .eq('registrant_id', user.id)
    .not('status', 'eq', 'REJECTED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return NextResponse.json({ registration: existing })

  const { data, error } = await service
    .from('office_registrations')
    .insert({ registrant_id: user.id, status: 'DRAFT', email: user.email })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ registration: data }, { status: 201 })
}

// GET: role-scoped list (registrant own / INT queue / admin queue).
export async function GET() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()

  // Disambiguate the embed: office_registrations has two FKs to profiles
  // (registrant_id and identity_verify_waived_by) — hint the registrant one.
  let query = service.from('office_registrations').select('*, profiles!registrant_id(full_name, phone)')

  if (profile?.role === 'int') {
    query = query.eq('status', 'PENDING_INT_SCREENING')
  } else if (profile?.role === 'admin') {
    query = query.in('status', ['PENDING_ADMIN_APPROVAL', 'APPROVED_GENERATING_CERT'])
  } else if (profile?.role === 'ict') {
    query = query.in('status', ['APPROVED_GENERATING_CERT', 'COMPLETED'])
  } else {
    query = query.eq('registrant_id', user.id)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ registrations: data })
}
