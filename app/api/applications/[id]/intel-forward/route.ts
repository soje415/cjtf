import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'
import { isValidRank } from '@/lib/ranks'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note, recommendedRank } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Screening note required' }, { status: 400 })
  if (!isValidRank(recommendedRank)) {
    return NextResponse.json({ error: 'Select a recommended rank' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'int') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: app } = await service.from('applications').select('id, status').eq('id', params.id).single()
  if (!app || app.status !== 'PENDING_INT_SCREENING') {
    return NextResponse.json({ error: 'Invalid application state' }, { status: 400 })
  }

  const { data: appInfo } = await service
    .from('applications')
    .select('first_name, last_name')
    .eq('id', params.id)
    .single()

  // Conditional on the prior status so a double submit can't fire twice.
  const { data: moved } = await service
    .from('applications')
    .update({
      status: 'PENDING_ADMIN_APPROVAL',
      recommended_rank: recommendedRank,
      int_cleared_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'PENDING_INT_SCREENING')
    .select('id')
    .maybeSingle()

  if (!moved) return NextResponse.json({ ok: true, alreadyProcessed: true })

  await service.from('application_notes').insert([
    {
      application_id: params.id,
      staff_id: user.id,
      note: note.trim(),
      action: 'int_cleared',
    },
    {
      application_id: params.id,
      staff_id: user.id,
      note: `Recommended rank: ${recommendedRank}`,
      action: 'rank_recommended',
    },
  ])

  // Notify all Admin officers
  const { data: admins } = await service.from('profiles').select('phone').eq('role', 'admin')
  const adminPhones = (admins ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    adminPhones,
    `CJTF Portal: Application from ${appInfo?.first_name} ${appInfo?.last_name} has cleared Intelligence screening and requires your approval.`
  )

  return NextResponse.json({ ok: true })
}
