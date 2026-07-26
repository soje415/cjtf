import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

// POST /api/applications/[id]/waive-verification — ICT or Admin override.
// Used when an applicant genuinely has no NIN/BVN or the KYC provider was
// unreachable, so identity verification could not be completed automatically.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'ict' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { reason } = await req.json()
  if (!reason || !String(reason).trim()) {
    return NextResponse.json({ error: 'A reason is required to waive verification.' }, { status: 400 })
  }

  const { error } = await service.from('applications').update({
    identity_verify_waived: true,
    identity_verify_waived_by: user.id,
    identity_verify_waived_reason: String(reason).trim(),
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await service.from('application_notes').insert({
    application_id: params.id,
    staff_id: user.id,
    note: `Identity verification waived: ${String(reason).trim()}`,
    action: 'identity_waived',
  })

  return NextResponse.json({ success: true })
}
