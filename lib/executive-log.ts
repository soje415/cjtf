import type { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * Record that an executive/DSS user viewed oversight data. This is the
 * accountability trail for privileged, full-visibility access — every dashboard
 * load and every applicant record opened is logged. Best-effort: logging must
 * never block the view itself.
 */
export async function logExecutiveAccess(
  service: ServiceClient,
  executiveId: string,
  action: 'view_dashboard' | 'view_application',
  applicationId?: string
): Promise<void> {
  await service
    .from('executive_access_log')
    .insert({
      executive_id: executiveId,
      action,
      application_id: applicationId ?? null,
    })
    .then(() => undefined, () => undefined)
}
