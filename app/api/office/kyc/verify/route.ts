import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { verifyIdentity, IdentityMethod } from '@/lib/hyparrow'

// POST /api/office/kyc/verify — office registrant verifies NIN or BVN.
// On success the government name/DOB/gender are written to the registration
// (the form locks them) and identity_verified is set true. Mirrors the
// recruitment KYC route (app/api/kyc/verify).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { regId, method, number } = await req.json()
  if (!regId || (method !== 'nin' && method !== 'bvn') || !number) {
    return NextResponse.json({ error: 'regId, method (nin|bvn) and number are required.' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: reg } = await service
    .from('office_registrations')
    .select('registrant_id, status')
    .eq('id', regId)
    .single()
  if (!reg || reg.registrant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (reg.status !== 'DRAFT' && reg.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Registration can no longer be edited.' }, { status: 400 })
  }

  const result = await verifyIdentity(method as IdentityMethod, String(number))
  if (!result.ok || !result.identity) {
    return NextResponse.json({ error: result.error ?? 'Verification failed.' }, { status: 422 })
  }

  const id = result.identity
  const clean = String(number).replace(/\D/g, '')

  const updates: Record<string, unknown> = {
    first_name: id.firstName,
    last_name: id.lastName,
    gender: id.gender,
    date_of_birth: id.dateOfBirth,
    [method === 'nin' ? 'nin' : 'bvn']: clean,
    identity_verified: true,
    identity_verify_method: method,
    identity_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (id.middleName) updates.middle_name = id.middleName

  const { error } = await service.from('office_registrations').update(updates).eq('id', regId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    method,
    identity: {
      first_name: id.firstName,
      middle_name: id.middleName,
      last_name: id.lastName,
      date_of_birth: id.dateOfBirth,
      gender: id.gender,
    },
  })
}
