import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canRegister } from '@/lib/roles'

// POST /api/staff/register — ICT/Admin creates an applicant's account and their
// DRAFT application (or office registration), then hands the staff member off to
// fill the form on that applicant's behalf.
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!canRegister(profile?.role)) {
    return NextResponse.json({ error: 'Only ICT or Admin can register applicants.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const fullName = String(body.fullName ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const phone = String(body.phone ?? '').trim()
  const mode = body.mode === 'office' ? 'office' : 'applicant'
  const membershipType = body.membershipType === 'legacy' ? 'legacy' : 'new'

  if (!fullName || !email || !phone) {
    return NextResponse.json({ error: 'Full name, email and phone are required.' }, { status: 400 })
  }

  // The applicant/registrant never logs in: this account is an internal identity
  // anchor only. Generate a random password that is never shared or stored in
  // plaintext anywhere a user can reach it.
  const password = randomUUID()

  // Create the applicant's own account. `email_confirm: true` because the
  // project runs with email confirmation off — the account must be usable
  // immediately (payment/tracking happen later under this login).
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'applicant', phone },
  })

  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Could not create the account.'
    const already = /already|registered|exists/i.test(msg)
    return NextResponse.json(
      { error: already ? 'An account with that email already exists.' : msg },
      { status: already ? 409 : 500 }
    )
  }

  const newId = created.user.id

  // The on_auth_user_created trigger writes the profile, but without the phone.
  await service.from('profiles').upsert(
    { id: newId, role: 'applicant', full_name: fullName, phone },
    { onConflict: 'id' }
  )

  if (mode === 'office') {
    const { data: reg, error: regErr } = await service
      .from('office_registrations')
      .insert({ registrant_id: newId, status: 'DRAFT', email, phone_number: phone })
      .select('id')
      .single()
    if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 })
    return NextResponse.json({ redirect: `/portal/staff/office/${reg.id}`, applicantId: newId })
  }

  const { data: app, error: appErr } = await service
    .from('applications')
    .insert({ applicant_id: newId, status: 'DRAFT', email, membership_type: membershipType, phone_number: phone })
    .select('id')
    .single()
  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 })
  return NextResponse.json({ redirect: `/portal/staff/application/${app.id}`, applicantId: newId })
}
