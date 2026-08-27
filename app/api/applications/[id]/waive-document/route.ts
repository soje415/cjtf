import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const WAIVABLE = {
  guarantor_form: {
    flag: 'guarantor_form_waived',
    by: 'guarantor_form_waived_by',
    reason: 'guarantor_form_waived_reason',
    label: 'guarantor form',
  },
  age_declaration: {
    flag: 'age_declaration_waived',
    by: 'age_declaration_waived_by',
    reason: 'age_declaration_waived_reason',
    label: 'declaration of age',
  },
} as const

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { document, reason } = await req.json()
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'Enter a reason to waive this document' }, { status: 400 })
  }
  const doc = WAIVABLE[document as keyof typeof WAIVABLE]
  if (!doc) return NextResponse.json({ error: 'Unknown document' }, { status: 400 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!['int', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await service
    .from('applications')
    .update({
      [doc.flag]: true,
      [doc.by]: user.id,
      [doc.reason]: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await service.from('application_notes').insert({
    application_id: params.id,
    staff_id: user.id,
    note: `Waived ${doc.label} requirement: ${reason.trim()}`,
    action: 'document_waived',
  })

  return NextResponse.json({ ok: true })
}
