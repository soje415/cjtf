import { createServiceClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function VerifyOfficePage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data: reg } = await supabase
    .from('office_registrations')
    .select('title, first_name, middle_name, last_name, cert_number, office_name, office_designation, office_address, district, area_council, completed_at')
    .eq('id', params.id)
    .eq('status', 'COMPLETED')
    .single()

  if (!reg) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✗</span>
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2">Not Verified</h2>
            <p className="text-gray-500 text-sm">This Operational Permit could not be verified. It may be invalid, revoked, or not yet issued.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = [reg.title, reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(' ')
  const officeName = [reg.office_name, reg.office_designation].filter(Boolean).join(' — ')
  const officeAddress = [reg.office_address, reg.district, reg.area_council].filter(Boolean).join(', ')

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <Card className="max-w-md w-full border-cjtf-green">
        <CardHeader className="bg-cjtf-green text-white rounded-t-lg pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cjtf-gold rounded-full flex items-center justify-center font-bold text-cjtf-green text-sm">
              CJTF
            </div>
            <div>
              <CardTitle className="text-white text-base">Operational Permit Verified</CardTitle>
              <p className="text-green-200 text-xs">Civilian Joint Task Force</p>
            </div>
            <Badge className="ml-auto bg-cjtf-gold text-cjtf-green font-semibold">✓ VALID</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Registrant</p>
              <p className="font-bold text-gray-800 text-base">{fullName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Permit Number</p>
              <p className="font-mono font-bold text-cjtf-green">{reg.cert_number ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Office</p>
              <p className="font-medium text-gray-800">{officeName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
              <p className="font-medium">{officeAddress}</p>
            </div>
            {reg.completed_at && (
              <div>
                <p className="text-xs text-gray-500">Permit Issued</p>
                <p className="font-medium">{new Date(reg.completed_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            Verified by CJTF Recruitment Portal &mdash; {new Date().toLocaleDateString('en-NG')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
