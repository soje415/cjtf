import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'

// POST: store the client-rendered Operational Permit PDF and mark the
// registration COMPLETED. Only ICT renders and uploads the permit binary.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: reg } = await service
      .from('office_registrations')
      .select('id, registrant_id, status, first_name, last_name, phone_number, office_name, cert_number')
      .eq('id', params.id)
      .single()
    if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only ICT generates/prints the Operational Permit. The registrant may
    // only ever download the PDF ICT already produced (see PermitDownload).
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'ict') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (reg.status !== 'APPROVED_GENERATING_CERT' && reg.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Registration is not ready for a permit' }, { status: 400 })
    }

    const pdfBuffer = Buffer.from(await req.arrayBuffer())
    if (pdfBuffer.length === 0) return NextResponse.json({ error: 'Empty PDF' }, { status: 400 })

    const pdfPath = `${reg.registrant_id}/${params.id}.pdf`
    const { error: uploadError } = await service.storage
      .from('certificates')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = service.storage.from('certificates').getPublicUrl(pdfPath)

    const updates: Record<string, unknown> = {
      cert_pdf_url: publicUrl,
      updated_at: new Date().toISOString(),
    }
    if (reg.status === 'APPROVED_GENERATING_CERT') {
      updates.status = 'COMPLETED'
      updates.completed_at = new Date().toISOString()
    }

    await service.from('office_registrations').update(updates).eq('id', params.id)

    // Record permit issuance once + notify the registrant.
    if (reg.status === 'APPROVED_GENERATING_CERT') {
      await service.from('office_registration_notes').insert({
        registration_id: params.id, staff_id: user.id,
        note: 'Operational Permit generated and saved by ICT.', action: 'cert_generated',
      })
      if (reg.phone_number) {
        await sendSms(
          reg.phone_number,
          `CJTF Portal: Your Operational Permit for "${reg.office_name}" has been issued${reg.cert_number ? ` (Permit No: ${reg.cert_number})` : ''}. Login to download: ${process.env.NEXT_PUBLIC_APP_URL}/portal/applicant/certificate`
        ).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, pdfUrl: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected error: ' + String(e) }, { status: 500 })
  }
}
