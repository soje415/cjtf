import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { canRegister } from '@/lib/roles'

// POST /api/kyc/defer — lets the applicant continue without NIN/BVN verification
// now and complete it later. Always available (a steady bypass) so registrations
// aren't blocked when the KYC provider is down or the wallet is unfunded.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appId } = await req.json()
  if (!appId) {
    return NextResponse.json({ error: 'appId is required.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Ownership + must still be editable. ICT/Admin may defer on the applicant's behalf.
  const { data: app } = await service
    .from('applications')
    .select('applicant_id, status')
    .eq('id', appId)
    .single()
  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!app || (app.applicant_id !== user.id && !canRegister(callerProfile?.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (app.status !== 'DRAFT' && app.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Application can no longer be edited.' }, { status: 400 })
  }

  const { error } = await service.from('applications').update({
    identity_verify_waived: true,
    identity_verify_waived_by: null,
    identity_verify_waived_reason:
      'Applicant continued without NIN/BVN verification — identity verification required before ID issuance.',
    updated_at: new Date().toISOString(),
  }).eq('id', appId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deferred: true })
}
