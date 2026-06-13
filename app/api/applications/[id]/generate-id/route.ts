import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCjtfId } from '@/lib/id-generator'
import { sendSms } from '@/lib/termii'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { session: _session } } = await supabase.auth.getSession()
    const user = _session?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { note } = body

    const service = createServiceClient()

    const { data: profile, error: profileErr } = await service
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profileErr) return NextResponse.json({ error: 'Profile lookup failed: ' + profileErr.message }, { status: 500 })
    if (profile?.role !== 'ict') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: app, error: appErr } = await service
      .from('applications')
      .select('*')
      .eq('id', params.id)
      .eq('status', 'APPROVED_GENERATING_ID')
      .maybeSingle()

    if (appErr) return NextResponse.json({ error: 'App lookup failed: ' + appErr.message }, { status: 500 })
    if (!app) return NextResponse.json({ error: 'Invalid application state or not found' }, { status: 400 })

    // Generate unique CJTF ID
    let cjtfId: string
    try {
      cjtfId = await generateCjtfId()
    } catch (e) {
      return NextResponse.json({ error: 'ID generation failed: ' + String(e) }, { status: 500 })
    }

    const fullName = [app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ')

    // Mark COMPLETED — PDF is generated client-side and saved via /save-pdf
    const { error: updateErr } = await service.from('applications').update({
      cjtf_id_number: cjtfId,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)

    if (updateErr) {
      return NextResponse.json({ error: 'Status update failed: ' + updateErr.message }, { status: 500 })
    }

    await service.from('application_notes').insert({
      application_id: params.id,
      staff_id: user.id,
      note: note?.trim() || `ID Card generated: ${cjtfId}`,
      action: 'id_generated',
    })

    // Notify applicant
    if (app.phone_number) {
      await sendSms(
        app.phone_number,
        `Congratulations ${fullName}! Your CJTF ID has been generated. ID: ${cjtfId}. Login to download: ${process.env.NEXT_PUBLIC_APP_URL}/portal/applicant/id-card`
      ).catch(() => {})
    }

    return NextResponse.json({ ok: true, cjtfId })
  } catch (e) {
    console.error('generate-id unexpected error:', e)
    return NextResponse.json({ error: 'Unexpected error: ' + String(e) }, { status: 500 })
  }
}
