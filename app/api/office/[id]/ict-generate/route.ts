import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCertNumber } from '@/lib/cert-generator'

// POST: ICT assigns the Operational Permit number for an admin-approved office
// registration (status APPROVED_GENERATING_CERT). The ICT client then renders
// the permit, captures the PDF, and posts it to save-cert (which sets COMPLETED).
// Idempotent: if a permit number already exists, it's returned unchanged.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ict') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: reg } = await service
    .from('office_registrations')
    .select('id, status, cert_number')
    .eq('id', params.id)
    .single()
  if (!reg || reg.status !== 'APPROVED_GENERATING_CERT') {
    return NextResponse.json({ error: 'Registration is not awaiting permit generation' }, { status: 400 })
  }

  if (reg.cert_number) return NextResponse.json({ ok: true, certNumber: reg.cert_number })

  // Read-max-then-+1 in lib/cert-generator.ts is not atomic, so two concurrent
  // generations can pick the same number; the UNIQUE constraint on cert_number
  // is the backstop. Guard the write on cert_number IS NULL (so a double click
  // can't assign twice) and retry on a unique violation (23505).
  for (let attempt = 0; attempt < 6; attempt++) {
    let certNumber: string
    try {
      certNumber = await generateCertNumber()
    } catch (e) {
      return NextResponse.json({ error: 'Permit number generation failed: ' + String(e) }, { status: 500 })
    }

    const { data: moved, error } = await service.from('office_registrations')
      .update({ cert_number: certNumber, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('cert_number', null)
      .select('cert_number')
      .maybeSingle()

    if (error) {
      if ((error as { code?: string }).code === '23505' && attempt < 5) continue
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!moved) {
      const { data: current } = await service.from('office_registrations')
        .select('cert_number').eq('id', params.id).maybeSingle()
      return NextResponse.json({ ok: true, certNumber: current?.cert_number ?? certNumber })
    }
    return NextResponse.json({ ok: true, certNumber })
  }

  return NextResponse.json({ error: 'Permit number generation failed after retries' }, { status: 500 })
}
