import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OfficeRegistrationForm, { Locality } from '@/components/office-form/OfficeRegistrationForm'
import { canRegister } from '@/lib/roles'

// "New office registration" entry: ICT/Admin land here straight from the
// dashboard and fill the form directly — the blank registrant record + DRAFT are
// created lazily on first save (see POST /api/office). No registration step.
export default async function StaffNewOfficePage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!canRegister(profile?.role)) redirect('/auth/login')

  const { data: rows } = await service
    .from('fct_localities')
    .select('area_council, district')
    .order('area_council')
    .order('district')

  const map = new Map<string, string[]>()
  for (const r of rows ?? []) {
    const list = map.get(r.area_council) ?? []
    list.push(r.district)
    map.set(r.area_council, list)
  }
  const localities: Locality[] = Array.from(map.entries()).map(([area_council, districts]) => ({ area_council, districts }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">New Office Registration</h1>
      <p className="text-sm text-gray-500">
        Fill the office registration on behalf of the registrant. The record is created as you go.
      </p>
      <OfficeRegistrationForm
        existing={null}
        localities={localities}
        afterSubmitPath={(id) => `/portal/staff/office/${id}`}
      />
    </div>
  )
}
