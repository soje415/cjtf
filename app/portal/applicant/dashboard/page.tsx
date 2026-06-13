import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { ApplicationStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

const STEPS: { status: ApplicationStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Fill Application' },
  { status: 'PENDING_ICT_VERIFICATION', label: 'ICT Verification' },
  { status: 'PENDING_INT_SCREENING', label: 'Intelligence Screening' },
  { status: 'PENDING_ADMIN_APPROVAL', label: 'Admin Approval' },
  { status: 'APPROVED_GENERATING_ID', label: 'ID Generation' },
  { status: 'COMPLETED', label: 'Completed' },
]

const STATUS_ORDER = STEPS.map((s) => s.status)

function getStepIndex(status: ApplicationStatus) {
  const i = STATUS_ORDER.indexOf(status)
  return i === -1 ? 0 : i
}

export default async function ApplicantDashboard() {
  const supabase = createClient()
  const service = createServiceClient()
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? ''

  const { data: app } = await service
    .from('applications')
    .select('*')
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentStep = app ? getStepIndex(app.status as ApplicationStatus) : 0
  const isRejected = app?.status === 'REJECTED'
  const isCompleted = app?.status === 'COMPLETED'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Application</h1>
        <p className="text-gray-500 text-sm mt-1">Track your CJTF recruitment application status</p>
      </div>

      {app ? (
        <Card className={isRejected ? 'border-red-300' : isCompleted ? 'border-cjtf-green' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Application Status</CardTitle>
              <Badge className={STATUS_COLORS[app.status as ApplicationStatus]}>
                {STATUS_LABELS[app.status as ApplicationStatus]}
              </Badge>
            </div>
            {app.cjtf_id_number && (
              <p className="text-sm font-mono text-cjtf-green font-semibold">{app.cjtf_id_number}</p>
            )}
          </CardHeader>
          <CardContent>
            {isRejected ? (
              <p className="text-red-600 text-sm">Your application was not approved. Please contact the CJTF office for more information.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {STEPS.map((step, i) => (
                  <div key={step.status} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i < currentStep ? 'bg-cjtf-green text-white' :
                      i === currentStep ? 'bg-cjtf-gold text-cjtf-green' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <span className={`text-sm ${i === currentStep ? 'font-semibold text-gray-800' : i < currentStep ? 'text-gray-500 line-through' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-10">
            <p className="text-gray-500 mb-4">You have not started an application yet.</p>
            <LinkButton href="/portal/applicant/application" className="bg-cjtf-green hover:bg-cjtf-green-dark">
              Start Application
            </LinkButton>
          </CardContent>
        </Card>
      )}

      {app && (
        <div className="flex flex-wrap gap-3">
          {app.status === 'DRAFT' && (
            <LinkButton href="/portal/applicant/application" className="bg-cjtf-green hover:bg-cjtf-green-dark">
              Continue Application
            </LinkButton>
          )}
{app.status === 'COMPLETED' && (
            <LinkButton href="/portal/applicant/id-card" className="bg-cjtf-green hover:bg-cjtf-green-dark">
              Download ID Card
            </LinkButton>
          )}
        </div>
      )}
    </div>
  )
}
