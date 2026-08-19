import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ict') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: app } = await service
    .from('applications')
    .select('id, status, membership_type, first_name, last_name')
    .eq('id', params.id)
    .single()
  if (!app || app.status !== 'PENDING_ICT_VERIFICATION') {
    return NextResponse.json({ error: 'Invalid application state' }, { status: 400 })
  }

  // Legacy members are already vetted — skip INT screening and go straight
  // to Admin approval. New recruits still go through Intelligence.
  const isLegacy = app.membership_type === 'legacy'
  const targetStatus = isLegacy ? 'PENDING_ADMIN_APPROVAL' : 'PENDING_INT_SCREENING'

  // Guard the write on the status we validated above, not just the id. Without
  // it, two quick clicks both pass the check and both write, duplicating the
  // audit note and firing a second SMS blast to every officer downstream.
  const { data: moved } = await service
    .from('applications')
    .update({
      status: targetStatus,
      ict_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'PENDING_ICT_VERIFICATION')
    .select('id')
    .maybeSingle()

  if (!moved) return NextResponse.json({ ok: true, alreadyProcessed: true })

  if (note?.trim()) {
    await service.from('application_notes').insert({
      application_id: params.id,
      staff_id: user.id,
      note: note.trim(),
      action: 'ict_verified',
    })
  }

  // Notify the next stage: Admin directly for legacy members (INT is skipped),
  // INT officers otherwise.
  const { data: nextOfficers } = await service
    .from('profiles')
    .select('phone')
    .eq('role', isLegacy ? 'admin' : 'int')
  const nextPhones = (nextOfficers ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    nextPhones,
    isLegacy
      ? `CJTF Portal: Legacy member ${app.first_name} ${app.last_name} has been verified by ICT and is ready for Command approval.`
      : `CJTF Portal: Application from ${app.first_name} ${app.last_name} has been verified by ICT and is ready for Intelligence screening.`
  )

  return NextResponse.json({ ok: true })
}
