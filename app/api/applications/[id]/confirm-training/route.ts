import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const note = body.note

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: app } = await service
    .from('applications')
    .select('id, status, first_name, last_name')
    .eq('id', params.id)
    .single()
  if (!app || app.status !== 'PENDING_TRAINING') {
    return NextResponse.json({ error: 'Invalid application state' }, { status: 400 })
  }

  await service.from('applications').update({
    status: 'APPROVED_GENERATING_ID',
    trained_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)

  await service.from('application_notes').insert({
    application_id: params.id,
    staff_id: user.id,
    note: (note?.trim?.() || 'Training completed'),
    action: 'training_completed',
  })

  // Notify all ICT officers to generate the ID card
  const { data: ictOfficers } = await service.from('profiles').select('phone').eq('role', 'ict')
  const ictPhones = (ictOfficers ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    ictPhones,
    `CJTF Portal: ${app.first_name} ${app.last_name} has completed training. Please log in to generate their ID card.`
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
