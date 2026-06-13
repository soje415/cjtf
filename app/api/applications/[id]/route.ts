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
  if (app.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Application already submitted' }, { status: 400 })
  }

  const allowed = [
    'first_name','last_name','middle_name','date_of_birth','gender',
    'state_of_origin','lga_of_origin','residential_address','phone_number','email','nin',
    'next_of_kin_name','next_of_kin_phone','next_of_kin_relationship',
    'passport_photo_url','id_document_url','birth_cert_url',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

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
    .select('applicant_id, status, first_name, last_name, phone_number, passport_photo_url')
    .eq('id', params.id)
    .single()

  if (!app || app.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (app.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
  }

  const required = ['first_name','last_name','phone_number','passport_photo_url']
  for (const field of required) {
    if (!app[field as keyof typeof app]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  // Payment bypassed — go straight to ICT queue. Re-enable when Paystack is wired up.
  const { error } = await service
    .from('applications')
    .update({ status: 'PENDING_ICT_VERIFICATION', submitted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify all ICT officers
  const { data: ictOfficers } = await service.from('profiles').select('phone').eq('role', 'ict')
  const ictPhones = (ictOfficers ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    ictPhones,
    `CJTF Portal: New application from ${app.first_name} ${app.last_name} is ready for ICT verification. Log in to review.`
  )

  return NextResponse.json({ success: true })
}
