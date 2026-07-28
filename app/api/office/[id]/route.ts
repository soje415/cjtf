import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('office_registrations')
    .select('*, payments(*), office_registration_notes(*, profiles(full_name, role))')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
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

  if (!reg || reg.registrant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (reg.status !== 'DRAFT' && reg.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Registration can no longer be edited' }, { status: 400 })
  }

  const allowed = [
    'title', 'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender',
    'phone_number', 'email', 'residential_address', 'nin', 'bvn', 'identity_verify_waived',
    'office_name', 'office_designation', 'area_council', 'district',
    'office_address', 'landmark', 'office_photo_urls',
    'district_head_name', 'endorsement_doc_url',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

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
    .select('registrant_id, status, first_name, last_name, phone_number, office_name, area_council, district, office_address, office_photo_urls, rejected_by_role, identity_verified, identity_verify_waived')
    .eq('id', params.id)
    .single()

  if (!reg || reg.registrant_id !== user.id) {
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
  ]
  for (const [field, value] of required) {
    if (!value) return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
  }
  if (!reg.office_photo_urls || reg.office_photo_urls.length === 0) {
    return NextResponse.json({ error: 'Please upload at least one photo of the office space.' }, { status: 400 })
  }

  // Identity must be verified (NIN/BVN) — or waived by staff.
  if (!reg.identity_verified && !reg.identity_verify_waived) {
    return NextResponse.json(
      { error: 'Please verify your identity with your NIN or BVN before submitting.' },
      { status: 403 }
    )
  }

  if (isResubmit) {
    const target = reg.rejected_by_role === 'admin' ? 'PENDING_ADMIN_APPROVAL' : 'PENDING_INT_SCREENING'
    const { error: reErr } = await service.from('office_registrations').update({
      status: target,
      rejected_by_role: null,
      rejected_at: null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)
    if (reErr) return NextResponse.json({ error: reErr.message }, { status: 500 })

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

  const { error } = await service
    .from('office_registrations')
    .update({ status: 'PENDING_PAYMENT', submitted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (reg.phone_number) {
    await sendSms(
      reg.phone_number,
      `CJTF Portal: Thank you, ${reg.first_name} ${reg.last_name}. Your office registration "${reg.office_name}" has been received. Please pay the registration fee to continue.`
    ).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
