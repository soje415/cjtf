import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    // Only ICT can save PDFs
    const { data: profile } = await service.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'ict') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Verify the application exists and is COMPLETED
    const { data: app } = await service
      .from('applications')
      .select('applicant_id, status')
      .eq('id', params.id)
      .single()

    if (!app || app.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Application not found or not completed' }, { status: 400 })
    }

    const pdfBuffer = Buffer.from(await req.arrayBuffer())
    if (pdfBuffer.length === 0) return NextResponse.json({ error: 'Empty PDF' }, { status: 400 })

    const pdfPath = `${app.applicant_id}/${params.id}.pdf`
    const { error: uploadError } = await service.storage
      .from('id-cards')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = service.storage.from('id-cards').getPublicUrl(pdfPath)

    await service.from('applications')
      .update({ id_card_pdf_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ ok: true, pdfUrl: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected error: ' + String(e) }, { status: 500 })
  }
}
