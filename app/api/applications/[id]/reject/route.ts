import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!['int', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const validStatuses = profile?.role === 'int'
    ? ['PENDING_INT_SCREENING']
    : ['PENDING_ADMIN_APPROVAL']

  const { data: app } = await service.from('applications').select('id, status').eq('id', params.id).single()
  if (!app || !validStatuses.includes(app.status)) {
    return NextResponse.json({ error: 'Invalid application state' }, { status: 400 })
  }

  await service.from('applications').update({
    status: 'REJECTED',
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)

  await service.from('application_notes').insert({
    application_id: params.id,
    staff_id: user.id,
    note: note.trim(),
    action: profile?.role === 'int' ? 'int_rejected' : 'admin_rejected',
  })

  return NextResponse.json({ ok: true })
}
