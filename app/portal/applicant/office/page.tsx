import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import OfficeRegistrationForm, { Locality } from '@/components/office-form/OfficeRegistrationForm'
import { OFFICE_STATUS_LABELS, OFFICE_STATUS_COLORS, OfficeRegistration } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'

export default async function OfficePage() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login?next=/portal/applicant/office')

  const { data: reg } = await service
    .from('office_registrations')
    .select('*')
    .eq('registrant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: OfficeRegistration | null }

  // Editable while DRAFT or after rejection → show the wizard.
  if (!reg || reg.status === 'DRAFT' || reg.status === 'REJECTED') {
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
        {reg?.status === 'REJECTED' && reg.rejection_reason && (
          <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
            <strong>Your previous submission was not approved.</strong> Reason: {reg.rejection_reason}. Correct the issues below and resubmit.
          </div>
        )}
        <OfficeRegistrationForm existing={reg} localities={localities} />
      </div>
    )
  }

  // Mid-flow / completed → status view.
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Office Registration</h1>
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">{reg.office_name}</p>
              <p className="text-sm text-gray-500">{reg.area_council} · {reg.district}</p>
            </div>
            <Badge className={OFFICE_STATUS_COLORS[reg.status]}>{OFFICE_STATUS_LABELS[reg.status]}</Badge>
          </div>

          {reg.status === 'PENDING_PAYMENT' && (
            <LinkButton href="/portal/applicant/office/payment" className="bg-cjtf-green hover:bg-cjtf-green-dark">
              Pay Registration Fee →
            </LinkButton>
          )}

          {(reg.status === 'PENDING_INT_SCREENING' || reg.status === 'PENDING_ADMIN_APPROVAL') && (
            <p className="text-sm text-gray-600">
              Your registration is under review. You&apos;ll be notified by SMS once a decision is made.
            </p>
          )}

          {reg.status === 'APPROVED_GENERATING_CERT' && (
            <p className="text-sm text-cjtf-green font-medium">
              Approved by Command. Your Operational Permit is being prepared by the ICT section — you&apos;ll be notified once it&apos;s issued.
            </p>
          )}

          {reg.status === 'COMPLETED' && (
            <div className="space-y-2">
              <p className="text-sm text-cjtf-green font-medium">
                Your Operational Permit {reg.cert_number ? `(${reg.cert_number})` : ''} has been issued.
              </p>
              <Link href="/portal/applicant/certificate" className="text-cjtf-blue underline text-sm">
                Download your Operational Permit →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
