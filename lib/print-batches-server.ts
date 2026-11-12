import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { PrintAction } from '@/lib/print-batches'

type Service = ReturnType<typeof createServiceClient>

/** Resolve the signed-in staff member's id + role (service client: profiles RLS recurses). */
export async function getStaffSession(): Promise<{ userId: string; role: string; service: Service } | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null
  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile?.role) return null
  return { userId: user.id, role: profile.role as string, service }
}

export async function logPrintEvent(
  service: Service,
  batchId: string,
  actorId: string,
  actorRole: string,
  action: PrintAction,
  note?: string | null
) {
  await service.from('print_events').insert({
    batch_id: batchId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    note: note?.trim() || null,
  })
}
