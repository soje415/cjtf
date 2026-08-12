import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Decision note required' }, { status: 400 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: app } = await service.from('applications').select('id, status').eq('id', params.id).single()
  if (!app || app.status !== 'PENDING_ADMIN_APPROVAL') {
    return NextResponse.json({ error: 'Invalid application state' }, { status: 400 })
  }

  const { data: appInfo } = await service
    .from('applications')
    .select('first_name, last_name, phone_number')
    .eq('id', params.id)
    .single()

  // Conditional on the prior status so a double submit can't fire twice.
  const { data: moved } = await service
    .from('applications')
    .update({
      status: 'PENDING_TRAINING',
      admin_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'PENDING_ADMIN_APPROVAL')
    .select('id')
    .maybeSingle()

  if (!moved) return NextResponse.json({ ok: true, alreadyProcessed: true })

  await service.from('application_notes').insert({
    application_id: params.id,
    staff_id: user.id,
    note: note.trim(),
    action: 'admin_approved',
  })

  // Notify the applicant that they've been cleared for training
  if (appInfo?.phone_number) {
    await sendSms(
      appInfo.phone_number,
      `CJTF Portal: Congratulations ${appInfo.first_name} ${appInfo.last_name}, you have been cleared by Command and are now scheduled for training. You will be notified of the next steps.`
    ).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
