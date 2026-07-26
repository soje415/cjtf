import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST: create (or return) the registrant's active office registration draft.
export async function POST() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Reuse any existing non-rejected registration.
  const { data: existing } = await service
    .from('office_registrations')
    .select('id, status')
    .eq('registrant_id', user.id)
    .not('status', 'eq', 'REJECTED')
    .maybeSingle()

  if (existing) return NextResponse.json({ registration: existing })

  const { data, error } = await service
    .from('office_registrations')
    .insert({ registrant_id: user.id, status: 'DRAFT', email: user.email })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ registration: data }, { status: 201 })
}

// GET: role-scoped list (registrant own / INT queue / admin queue).
export async function GET() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()

  // Disambiguate the embed: office_registrations has two FKs to profiles
  // (registrant_id and identity_verify_waived_by) — hint the registrant one.
  let query = service.from('office_registrations').select('*, profiles!registrant_id(full_name, phone)')

  if (profile?.role === 'int') {
    query = query.eq('status', 'PENDING_INT_SCREENING')
  } else if (profile?.role === 'admin') {
    query = query.in('status', ['PENDING_ADMIN_APPROVAL', 'APPROVED_GENERATING_CERT'])
  } else {
    query = query.eq('registrant_id', user.id)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ registrations: data })
}
