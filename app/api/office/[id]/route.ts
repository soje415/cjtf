import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'
import { officeChecksRelaxed, describeSkippedOfficeChecks } from '@/lib/pilot'
import { canRegister } from '@/lib/roles'

const STAFF_ROLES = ['ict', 'int', 'admin', 'executive']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isStaff = profile?.role ? STAFF_ROLES.includes(profile.role) : false

  const { data, error } = await service
    .from('office_registrations')
    .select('*, payments(*), office_registration_notes(*, profiles(full_name, role))')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  if (!isStaff && data.registrant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ registration: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const service = createServiceClient()

  const { data: reg } = await service
    .from('office_registrations')
    .select('registrant_id, status')
    .eq('id', params.id)
    .single()

  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!reg || (reg.registrant_id !== user.id && !canRegister(callerProfile?.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (reg.status !== 'DRAFT' && reg.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Registration can no longer be edited' }, { status: 400 })
  }

  const allowed = [
    'title', 'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender',
    'phone_number', 'email', 'residential_address', 'nin', 'bvn',
    'office_name', 'office_designation', 'area_council', 'district',
    'office_address', 'landmark', 'office_photo_urls',
    'district_head_name', 'endorsement_doc_url',
    'sector_command', 'sub_sector', 'unit',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  // date_of_birth is a `date` column and gender has a CHECK ('male'|'female')
  // constraint — the form sends '' by default for both, which Postgres
  // rejects outright instead of silently ignoring.
  if (updates.date_of_birth === '') updates.date_of_birth = null
  if (updates.gender === '') updates.gender = null

  const { data, error } = await service
    .from('office_registrations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ registration: data })
}

// POST: submit. DRAFT → PENDING_PAYMENT (or re-route a corrected rejection).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: reg } = await service
    .from('office_registrations')
    .select('registrant_id, status, first_name, last_name, phone_number, office_name, area_council, district, office_address, office_photo_urls, rejected_by_role, identity_verified, identity_verify_waived, sector_command, sub_sector, unit')
    .eq('id', params.id)
    .single()

  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!reg || (reg.registrant_id !== user.id && !canRegister(callerProfile?.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const isResubmit = reg.status === 'REJECTED'
  if (reg.status !== 'DRAFT' && !isResubmit) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
  }

  // Required office details + at least one office-space photo.
  const required: Array<[string, unknown]> = [
    ['first_name', reg.first_name],
    ['last_name', reg.last_name],
    ['phone_number', reg.phone_number],
    ['office_name', reg.office_name],
    ['area_council', reg.area_council],
    ['district', reg.district],
    ['office_address', reg.office_address],
    ['sector_command', reg.sector_command],
    ['sub_sector', reg.sub_sector],
  ]
  for (const [field, value] of required) {
    if (!value) return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
  }
  // Office-space photo + NIN/BVN identity confirmation. Both are normally hard
  // gates; the pilot flag turns them into recorded exceptions instead of
  // blockers so the flow can be exercised end to end. See lib/pilot.ts.
  const relaxed = officeChecksRelaxed()
  const missingPhotos = !reg.office_photo_urls || reg.office_photo_urls.length === 0
  const missingIdentity = !reg.identity_verified && !reg.identity_verify_waived

  if (missingPhotos && !relaxed) {
    return NextResponse.json({ error: 'Please upload at least one photo of the office space.' }, { status: 400 })
  }

  if (missingIdentity && !relaxed) {
    return NextResponse.json(
      { error: 'Please verify your identity with your NIN or BVN before submitting.' },
      { status: 403 }
    )
  }

  // Leave a trail of exactly what was waived, so these registrations can be
  // found and re-verified when the checks are hardened.
  const skipNote = relaxed ? describeSkippedOfficeChecks({ missingPhotos, missingIdentity }) : null
  if (skipNote) {
    await service.from('office_registration_notes').insert({
      registration_id: params.id,
      staff_id: user.id,
      note: skipNote,
      action: 'pilot_checks_relaxed',
    })
  }

  if (isResubmit) {
    const target = reg.rejected_by_role === 'admin' ? 'PENDING_ADMIN_APPROVAL' : 'PENDING_INT_SCREENING'
    const { data: moved, error: reErr } = await service.from('office_registrations').update({
      status: target,
      rejected_by_role: null,
      rejected_at: null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id).eq('status', 'REJECTED').select('id').maybeSingle()
    if (reErr) return NextResponse.json({ error: reErr.message }, { status: 500 })
    if (!moved) return NextResponse.json({ ok: true, alreadyProcessed: true })

    await service.from('office_registration_notes').insert({
      registration_id: params.id,
      staff_id: user.id,
      note: 'Registrant corrected the issues and resubmitted.',
      action: 'resubmitted',
    })

    const targetRole = target === 'PENDING_ADMIN_APPROVAL' ? 'admin' : 'int'
    const { data: officers } = await service.from('profiles').select('phone').eq('role', targetRole)
    const officerPhones = (officers ?? []).map((p) => p.phone).filter(Boolean) as string[]
    await sendSms(
      officerPhones,
      `CJTF Portal: Office registration "${reg.office_name}" was corrected and resubmitted. Please re-review.`
    ).catch(() => {})

    return NextResponse.json({ success: true, resubmitted: true })
  }

  // Conditional on the status we validated above, so a double submit can't fire
  // the confirmation SMS twice (mirrors the recruitment submit route).
  const { data: moved } = await service
    .from('office_registrations')
    .update({ status: 'PENDING_PAYMENT', submitted_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'DRAFT')
    .select('id')
    .maybeSingle()

  if (!moved) return NextResponse.json({ ok: true, alreadyProcessed: true })

  if (reg.phone_number) {
    await sendSms(
      reg.phone_number,
      `CJTF Portal: Thank you, ${reg.first_name} ${reg.last_name}. Your office registration "${reg.office_name}" has been received. Please pay the registration fee to continue.`
    ).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
