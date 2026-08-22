import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OfficeRegistrationForm, { Locality } from '@/components/office-form/OfficeRegistrationForm'
import OfficeVirtualAccountPayment from '@/components/office-form/OfficeVirtualAccountPayment'
import { canRegister } from '@/lib/roles'
import { Badge } from '@/components/ui/badge'
import { OFFICE_STATUS_LABELS, OFFICE_STATUS_COLORS, OfficeRegistration } from '@/lib/types'

// Staff fill-on-behalf page: ICT/Admin completes an office registration that has
// no login of its own, then collects the fee and hands it through review.
export default async function StaffOfficePage({ params }: { params: { id: string } }) {
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

  const { data: regData } = await service
    .from('office_registrations')
    .select('*')
    .eq('id', params.id)
    .single()
  const reg = regData as OfficeRegistration | null
  if (!reg) redirect('/portal/ict/dashboard')

  const editable = reg.status === 'DRAFT' || reg.status === 'REJECTED'
  const awaitingPayment = reg.status === 'PENDING_PAYMENT'

  if (editable) {
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Complete Office Registration</h1>
          <Badge className={OFFICE_STATUS_COLORS[reg.status]}>{OFFICE_STATUS_LABELS[reg.status]}</Badge>
        </div>
        <p className="text-sm text-gray-500">
          Filling on behalf of <strong>{reg.first_name || 'registrant'}</strong> · {reg.email}
        </p>
        <OfficeRegistrationForm
          existing={reg}
          localities={localities}
          afterSubmitPath={`/portal/staff/office/${reg.id}`}
        />
      </div>
    )
  }

  if (awaitingPayment) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Collect Office Fee</h1>
        <OfficeVirtualAccountPayment
          registrationId={reg.id}
          name={`${reg.first_name} ${reg.last_name}`}
          officeName={reg.office_name ?? 'office'}
          redirectPath={`/portal/staff/office/${reg.id}`}
        />
      </div>
    )
  }

  redirect('/portal/ict/dashboard')
}
