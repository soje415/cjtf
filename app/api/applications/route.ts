import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Check for existing non-rejected application
  const { data: existing } = await service
    .from('applications')
    .select('id, status')
    .eq('applicant_id', user.id)
    .not('status', 'eq', 'REJECTED')
    .maybeSingle()

  if (existing) return NextResponse.json({ application: existing })

  const { data, error } = await service
    .from('applications')
    .insert({ applicant_id: user.id, status: 'DRAFT', email: user.email })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ application: data }, { status: 201 })
}

export async function GET() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  let query = service.from('applications').select('*, profiles(full_name, phone)')

  if (profile?.role === 'applicant') {
    query = query.eq('applicant_id', user.id)
  } else if (profile?.role === 'ict') {
    query = query.in('status', ['PENDING_ICT_VERIFICATION', 'APPROVED_GENERATING_ID'])
  } else if (profile?.role === 'int') {
    query = query.eq('status', 'PENDING_INT_SCREENING')
  } else if (profile?.role === 'admin') {
    query = query.eq('status', 'PENDING_ADMIN_APPROVAL')
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ applications: data })
}
