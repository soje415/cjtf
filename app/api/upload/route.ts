import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileName, contentType, applicationId } = await req.json()
  if (!fileName || !applicationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!UUID_RE.test(applicationId)) {
    return NextResponse.json({ error: 'Invalid document owner id' }, { status: 400 })
  }
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  // The browser may not always detect a MIME type; only reject one that is
  // explicitly present AND not an image/PDF we accept.
  if (contentType && !ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const service = createServiceClient()

  // The upload route serves both application documents and office-registration
  // photos, so `applicationId` is the owning record id in EITHER table. A
  // signed URL must only be minted for the caller's own record — otherwise any
  // user could plant files in another applicant's (now-public) folder.
  const { data: app } = await service
    .from('applications')
    .select('applicant_id')
    .eq('id', applicationId)
    .maybeSingle()
  let owned = app?.applicant_id === user.id
  if (!owned) {
    const { data: reg } = await service
      .from('office_registrations')
      .select('registrant_id')
      .eq('id', applicationId)
      .maybeSingle()
    owned = reg?.registrant_id === user.id
  }
  if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const path = `${applicationId}/${Date.now()}.${ext}`

  const { data, error } = await service.storage
    .from('applicant-documents')
    .createSignedUploadUrl(path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const publicUrl = service.storage
    .from('applicant-documents')
    .getPublicUrl(path).data.publicUrl

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl })
}
