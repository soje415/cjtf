import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCjtfId } from '@/lib/id-generator'
import { sendSms } from '@/lib/termii'
import { PORTAL_URL } from '@/lib/portal-url'

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

    // The rank is printed on the card face, so a card can't be issued without
    // one. Admin sets it at approval, which is upstream of this route.
    if (!app.cjtf_rank) {
      return NextResponse.json(
        { error: 'No rank assigned by Command — the ID card cannot be issued without one.' },
        { status: 400 }
      )
    }

    // Generate unique CJTF ID. The read-max-then-+1 in lib/id-generator.ts is
    // not atomic, so two concurrent generations can pick the same number; the
    // UNIQUE constraint on cjtf_id_number is the backstop. Retry on a unique
    // violation (23505) and re-guard the update on status so a double click
    // can't issue twice.
    const fullName = [app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ')

    let cjtfId = ''
    let moved: { id: string; cjtf_id_number: string } | null = null
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        cjtfId = await generateCjtfId()
      } catch (e) {
        return NextResponse.json({ error: 'ID generation failed: ' + String(e) }, { status: 500 })
      }

      const { data, error: updateErr } = await service.from('applications').update({
        cjtf_id_number: cjtfId,
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', params.id).eq('status', 'APPROVED_GENERATING_ID').select('id, cjtf_id_number').maybeSingle()

      if (updateErr) {
        if ((updateErr as { code?: string }).code === '23505' && attempt < 5) continue
        return NextResponse.json({ error: 'Status update failed: ' + updateErr.message }, { status: 500 })
      }
      moved = data ?? null
      break
    }

    if (!moved) {
      // Someone else already issued this card (double click / race) — hand back
      // the number that was written so the client can still render the PDF.
      const { data: current } = await service.from('applications')
        .select('cjtf_id_number').eq('id', params.id).maybeSingle()
      return NextResponse.json({ ok: true, alreadyProcessed: true, cjtfId: current?.cjtf_id_number })
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
        `Congratulations ${fullName}! Your CJTF ID has been generated. Rank: ${app.cjtf_rank}. ID: ${cjtfId}. Login to download: ${PORTAL_URL}/portal/applicant/id-card`
      ).catch(() => {})
    }

    return NextResponse.json({ ok: true, cjtfId })
  } catch (e) {
    console.error('generate-id unexpected error:', e)
    return NextResponse.json({ error: 'Unexpected error: ' + String(e) }, { status: 500 })
  }
}
