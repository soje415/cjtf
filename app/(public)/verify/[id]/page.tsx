import { createServiceClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function VerifyPage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data: app } = await supabase
    .from('applications')
    .select('first_name, middle_name, last_name, cjtf_id_number, cjtf_rank, state_of_origin, lga_of_origin, passport_photo_url, completed_at')
    .eq('id', params.id)
    .eq('status', 'COMPLETED')
    .single()

  if (!app) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✗</span>
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2">Not Verified</h2>
            <p className="text-gray-500 text-sm">This ID could not be verified. It may be invalid, revoked, or not yet issued.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <Card className="max-w-md w-full border-cjtf-green">
        <CardHeader className="bg-cjtf-green text-white rounded-t-lg pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cjtf-gold rounded-full flex items-center justify-center font-bold text-cjtf-green text-sm">
              CJTF
            </div>
            <div>
              <CardTitle className="text-white text-base">Identity Verified</CardTitle>
              <p className="text-green-200 text-xs">Civilian Joint Task Force</p>
            </div>
            <Badge className="ml-auto bg-cjtf-gold text-cjtf-green font-semibold">✓ VALID</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex gap-4 items-start">
            {app.passport_photo_url && (
              <Image
                src={app.passport_photo_url}
                alt="ID Photo"
                width={80}
                height={96}
                className="rounded border-2 border-cjtf-green object-cover flex-shrink-0"
              />
            )}
            <div className="space-y-2 text-sm flex-1">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Full Name</p>
                <p className="font-bold text-gray-800 text-base">{app.first_name} {app.middle_name} {app.last_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">CJTF ID Number</p>
                <p className="font-mono font-bold text-cjtf-green">{app.cjtf_id_number}</p>
              </div>
              {app.cjtf_rank && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Rank</p>
                  <p className="font-bold text-gray-800">{app.cjtf_rank}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500">State</p>
                  <p className="font-medium">{app.state_of_origin}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">LGA</p>
                  <p className="font-medium">{app.lga_of_origin}</p>
                </div>
              </div>
              {app.completed_at && (
                <div>
                  <p className="text-xs text-gray-500">ID Issued</p>
                  <p className="font-medium">{new Date(app.completed_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            Verified by CJTF Recruitment Portal &mdash; {new Date().toLocaleDateString('en-NG')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
