import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST: attach the signed District-Head endorsement document. The District Head
// has no login — the signed copy is uploaded by EITHER the registrant or an
// admin/INT staff member. Accepts the raw file body (uploaded via the service
// role so staff can write to the registrant's document folder).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: reg } = await service
    .from('office_registrations')
    .select('registrant_id')
    .eq('id', params.id)
    .single()
  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  const isOwner = reg.registrant_id === user.id
  const isStaff = ['int', 'admin'].includes(profile?.role ?? '')
  if (!isOwner && !isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contentType = req.headers.get('content-type') || 'application/octet-stream'
  const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg'
  const buffer = Buffer.from(await req.arrayBuffer())
  if (buffer.length === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 })

  const path = `${reg.registrant_id}/office-endorsement-${params.id}-${Date.now()}.${ext}`
  const { error: upErr } = await service.storage
    .from('applicant-documents')
    .upload(path, buffer, { contentType, upsert: true })
  if (upErr) return NextResponse.json({ error: 'Upload failed: ' + upErr.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('applicant-documents').getPublicUrl(path)

  await service.from('office_registrations')
    .update({ endorsement_doc_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  // Staff uploads are recorded in the audit trail.
  if (isStaff) {
    await service.from('office_registration_notes').insert({
      registration_id: params.id,
      staff_id: user.id,
      note: 'District-Head endorsement document uploaded by staff.',
      action: 'endorsement_uploaded',
    })
  }

  return NextResponse.json({ ok: true, url: publicUrl })
}
