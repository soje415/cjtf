import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { canRegister } from '@/lib/roles'

// POST /api/office/kyc/defer — mirrors /api/kyc/defer for the office
// registration flow. Always available (steady bypass) so registrations aren't
// blocked when the KYC provider is down or the wallet is unfunded.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { regId } = await req.json()
  if (!regId) {
    return NextResponse.json({ error: 'regId is required.' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: reg } = await service
    .from('office_registrations')
    .select('registrant_id, status')
    .eq('id', regId)
    .single()
  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!reg || (reg.registrant_id !== user.id && !canRegister(callerProfile?.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (reg.status !== 'DRAFT' && reg.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Registration can no longer be edited.' }, { status: 400 })
  }

  const { error } = await service.from('office_registrations').update({
    identity_verify_waived: true,
    identity_verify_waived_by: null,
    identity_verify_waived_reason:
      'Registrant continued without NIN/BVN verification — identity verification required before permit issuance.',
    updated_at: new Date().toISOString(),
  }).eq('id', regId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deferred: true })
}
