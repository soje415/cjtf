import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Applicant-submitted fields INT/Admin may correct after ICT intake. NIN and
// BVN are deliberately excluded — those only change through the identity
// verification flow, never a plain edit.
const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'middle_name', 'date_of_birth', 'gender',
  'state_of_origin', 'lga_of_origin', 'residential_address', 'phone_number', 'email',
  'title', 'mother_maiden_name', 'place_of_birth', 'nationality', 'marital_status',
  'religion', 'blood_group', 'height', 'distinguishing_marks', 'occupation', 'education',
  'state_of_residence', 'lga_of_residence', 'means_of_id_type', 'means_of_id_number',
  'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship', 'next_of_kin_address',
  'guarantor_name', 'guarantor_phone', 'guarantor_title', 'guarantor_address',
  'sector_command', 'sub_sector', 'unit',
  'self_reported_rank', 'legacy_id_number', 'vouching_officer_name',
] as const

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { updates, note } = await req.json()
  if (!note?.trim()) {
    return NextResponse.json({ error: 'A reason for the correction is required' }, { status: 400 })
  }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (!['int', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const keys = Object.keys(updates)
  const disallowed = keys.filter((k) => !(EDITABLE_FIELDS as readonly string[]).includes(k))
  if (disallowed.length > 0) {
    return NextResponse.json({ error: `Cannot edit: ${disallowed.join(', ')}` }, { status: 400 })
  }
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const { data: before } = await service.from('applications').select(keys.join(',')).eq('id', params.id).single()
  if (!before) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const beforeRow = before as unknown as Record<string, string | null>
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const diffLines: string[] = []
  for (const k of keys) {
    const raw = updates[k]
    const newVal = typeof raw === 'string' ? raw.trim() : raw
    const oldVal = beforeRow[k]
    if ((oldVal ?? '') === (newVal ?? '')) continue
    payload[k] = newVal === '' ? null : newVal
    diffLines.push(`${k}: "${oldVal ?? '—'}" → "${newVal || '—'}"`)
  }

  if (diffLines.length === 0) {
    return NextResponse.json({ error: 'No changes detected' }, { status: 400 })
  }

  const { error } = await service.from('applications').update(payload).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await service.from('application_notes').insert({
    application_id: params.id,
    staff_id: user.id,
    note: `${note.trim()}\n\nCorrected: ${diffLines.join('; ')}`,
    action: profile?.role === 'int' ? 'int_corrected' : 'admin_corrected',
  })

  return NextResponse.json({ ok: true })
}
