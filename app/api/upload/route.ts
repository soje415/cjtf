import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileName, contentType, applicationId } = await req.json()
  if (!fileName || !contentType || !applicationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const ext = fileName.split('.').pop()
  const path = `${applicationId}/${Date.now()}.${ext}`

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('applicant-documents')
    .createSignedUploadUrl(path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const publicUrl = service.storage
    .from('applicant-documents')
    .getPublicUrl(path).data.publicUrl

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl })
}
