import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { verifyIdentity, IdentityMethod } from '@/lib/hyparrow'

// POST /api/kyc/verify — applicant verifies their NIN or BVN.
// On success the government-confirmed name/DOB/gender are written to the
// application (the form locks these fields), the official passport photo is
// stored as the default ID photo, and identity_verified is set true.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appId, method, number } = await req.json()
  if (!appId || (method !== 'nin' && method !== 'bvn') || !number) {
    return NextResponse.json({ error: 'appId, method (nin|bvn) and number are required.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Ownership + must still be editable.
  const { data: app } = await service
    .from('applications')
    .select('applicant_id, status, passport_photo_url')
    .eq('id', appId)
    .single()
  if (!app || app.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (app.status !== 'DRAFT' && app.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Application can no longer be edited.' }, { status: 400 })
  }

  const result = await verifyIdentity(method as IdentityMethod, String(number))
  if (!result.ok || !result.identity) {
    return NextResponse.json({ error: result.error ?? 'Verification failed.' }, { status: 422 })
  }

  const id = result.identity
  const clean = String(number).replace(/\D/g, '')

  // Store the official passport photo as the default ID photo (the applicant
  // can later upload a sharper image to replace it). Skip if they already
  // uploaded one of their own.
  let photoUrl = app.passport_photo_url ?? ''
  if (id.photoBase64 && !photoUrl) {
    try {
      const buffer = Buffer.from(id.photoBase64, 'base64')
      const path = `${appId}/kyc-photo-${Date.now()}.jpg`
      const { error: upErr } = await service.storage
        .from('applicant-documents')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
      if (!upErr) {
        photoUrl = service.storage.from('applicant-documents').getPublicUrl(path).data.publicUrl
      }
    } catch {
      // Non-fatal: verification still succeeds; applicant can upload a photo manually.
    }
  }

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
  if (photoUrl) updates.passport_photo_url = photoUrl

  // gender has a CHECK ('male'|'female') and date_of_birth is a `date` column —
  // the provider can return an empty value for either when the record lacks the
  // field, which Postgres rejects instead of ignoring. Null them out here just
  // like the PATCH route does (a '' default would otherwise 500 a good lookup).
  if (updates.gender === '') updates.gender = null
  if (updates.date_of_birth === '') updates.date_of_birth = null

  const { error } = await service.from('applications').update(updates).eq('id', appId)
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
    passport_photo_url: photoUrl || null,
  })
}
