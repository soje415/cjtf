import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Stores the two signatures that print on the ID card back.
 *
 * ICT captures them at the desk immediately before generating the card, and
 * they are uploaded here rather than embedded in the PDF alone, so the card the
 * applicant re-downloads later carries the same signatures as the one handed
 * over on the day.
 */

const MAX_BYTES = 2_000_000

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > MAX_BYTES) return null
  return { buffer, contentType: match[1] }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'ict') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { holderSignature, officerSignature } = await req.json().catch(() => ({}))
  if (!holderSignature && !officerSignature) {
    return NextResponse.json({ error: 'No signature supplied' }, { status: 400 })
  }

  const update: Record<string, string> = {}

  for (const [field, dataUrl] of [
    ['holder_signature_url', holderSignature],
    ['officer_signature_url', officerSignature],
  ] as const) {
    if (!dataUrl) continue
    const decoded = decodeDataUrl(String(dataUrl))
    if (!decoded) {
      return NextResponse.json({ error: 'Signature image is invalid or too large' }, { status: 400 })
    }
    const ext = decoded.contentType.split('/')[1].replace('jpeg', 'jpg')
    const path = `signatures/${params.id}/${field}-${Date.now()}.${ext}`
    const { error: uploadErr } = await service.storage
      .from('applicant-documents')
      .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true })
    if (uploadErr) {
      return NextResponse.json({ error: 'Signature upload failed: ' + uploadErr.message }, { status: 500 })
    }
    update[field] = service.storage.from('applicant-documents').getPublicUrl(path).data.publicUrl
  }

  const { error: saveErr } = await service
    .from('applications')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (saveErr) {
    return NextResponse.json({ error: 'Could not save signatures: ' + saveErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...update })
}
