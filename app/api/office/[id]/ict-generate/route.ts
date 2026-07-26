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

  let certNumber: string
  try {
    certNumber = await generateCertNumber()
  } catch (e) {
    return NextResponse.json({ error: 'Permit number generation failed: ' + String(e) }, { status: 500 })
  }

  const { error } = await service.from('office_registrations')
    .update({ cert_number: certNumber, updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, certNumber })
}
