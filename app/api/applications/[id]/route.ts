import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('applications')
    .select('*, payments(*), application_notes(*, profiles(full_name, role))')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ application: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const service = createServiceClient()

  // Verify ownership and DRAFT status
  const { data: app } = await service
    .from('applications')
    .select('applicant_id, status')
    .eq('id', params.id)
    .single()

  if (!app || app.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (app.status !== 'DRAFT' && app.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Application can no longer be edited' }, { status: 400 })
  }

  const allowed = [
    'first_name','last_name','middle_name','title','date_of_birth','gender',
    'mother_maiden_name','place_of_birth','nationality','marital_status','religion',
    'blood_group','height','distinguishing_marks','occupation','education',
    'state_of_origin','lga_of_origin','state_of_residence','lga_of_residence',
    'residential_address','phone_number','email','nin','bvn','identity_verify_waived',
    'means_of_id_type','means_of_id_number',
    'next_of_kin_name','next_of_kin_phone','next_of_kin_relationship','next_of_kin_address',
    'guarantor_name','guarantor_phone','guarantor_title','guarantor_address',
    'passport_photo_url','id_document_url','birth_cert_url',
    'guarantor_form_url','age_declaration_url',
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
    .from('applications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ application: data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // POST to submit: DRAFT → PENDING_PAYMENT
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: app } = await service
    .from('applications')
    .select('applicant_id, status, first_name, last_name, phone_number, passport_photo_url, rejected_by_role, identity_verified, identity_verify_waived')
    .eq('id', params.id)
    .single()

  if (!app || app.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const isResubmit = app.status === 'REJECTED'
  if (app.status !== 'DRAFT' && !isResubmit) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
  }

  const required = ['first_name','last_name','phone_number','passport_photo_url']
  for (const field of required) {
    if (!app[field as keyof typeof app]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  // Identity must be verified (NIN/BVN) — or explicitly waived by ICT/Admin.
  if (!app.identity_verified && !app.identity_verify_waived) {
    return NextResponse.json(
      { error: 'Please verify your identity with your NIN or BVN before submitting your application.' },
      { status: 403 }
    )
  }

  // PROTOTYPE: phone-number verification gate relaxed for testing.
  // Re-enable for production by uncommenting the block below.
  // const { data: profile } = await service
  //   .from('profiles')
  //   .select('phone_verified')
  //   .eq('id', user.id)
  //   .single()
  // if (!profile?.phone_verified) {
  //   return NextResponse.json(
  //     { error: 'Please verify your phone number before submitting your application.' },
  //     { status: 403 }
  //   )
  // }

  // Resubmission of a corrected, previously rejected application — route it
  // back to the stage that rejected it (or ICT if unknown).
  if (isResubmit) {
    const target =
      app.rejected_by_role === 'int' ? 'PENDING_INT_SCREENING'
      : app.rejected_by_role === 'admin' ? 'PENDING_ADMIN_APPROVAL'
      : 'PENDING_ICT_VERIFICATION'

    const { error: reErr } = await service.from('applications').update({
      status: target,
      rejected_by_role: null,
      rejected_at: null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)
    if (reErr) return NextResponse.json({ error: reErr.message }, { status: 500 })

    await service.from('application_notes').insert({
      application_id: params.id,
      staff_id: user.id,
      note: 'Applicant corrected the issues and resubmitted.',
      action: 'resubmitted',
    })

    const targetRole = target === 'PENDING_INT_SCREENING' ? 'int'
      : target === 'PENDING_ADMIN_APPROVAL' ? 'admin' : 'ict'
    const { data: officers } = await service.from('profiles').select('phone').eq('role', targetRole)
    const officerPhones = (officers ?? []).map((p) => p.phone).filter(Boolean) as string[]
    await sendSms(
      officerPhones,
      `CJTF Portal: ${app.first_name} ${app.last_name} corrected and resubmitted a previously rejected application. Please re-review.`
    ).catch(() => {})
    if (app.phone_number) {
      await sendSms(
        app.phone_number,
        `CJTF Portal: Your corrected application has been resubmitted and is under review again, ${app.first_name} ${app.last_name}.`
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, resubmitted: true })
  }

  // Submit → PENDING_PAYMENT. The applicant pays the fee via their dedicated
  // virtual account; once the transfer lands the webhook advances them to ICT
  // verification (notifyPaymentComplete), which is where ICT gets alerted.
  const { error } = await service
    .from('applications')
    .update({ status: 'PENDING_PAYMENT', submitted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Confirm receipt and prompt for payment.
  if (app.phone_number) {
    await sendSms(
      app.phone_number,
      `CJTF Portal: Thank you, ${app.first_name} ${app.last_name}. Your application has been received. Please pay the application fee to complete your submission.`
    ).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
