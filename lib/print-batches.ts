// A batch is a group of approved applicants (one Sector Command + Sub Sector)
// handed down the pipeline:  INT → Admin → ICT (generates each card) → printed → collected.

export type PrintStatus = 'not_queued' | 'queued' | 'printed' | 'collected'
export type BatchStatus = 'with_admin' | 'with_ict' | 'printed' | 'collected' | 'cancelled'
export type PrintAction =
  | 'sent' | 'forwarded' | 'returned' | 'downloaded' | 'printed' | 'collected' | 'cancelled' | 'reprint_requested'

export interface PrintBatch {
  id: string
  batch_no: string
  sector_command: string
  sub_sector: string
  group_key: string
  status: BatchStatus
  card_count: number
  requested_by: string | null
  requested_role: string | null
  note: string | null
  forwarded_by: string | null
  forwarded_at: string | null
  printed_by: string | null
  printed_at: string | null
  collected_by: string | null
  collected_at: string | null
  created_at: string
  updated_at: string
}

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  with_admin: 'Awaiting Admin',
  with_ict: 'With ICT',
  printed: 'Printed',
  collected: 'Collected',
  cancelled: 'Cancelled',
}

export const BATCH_STATUS_COLORS: Record<BatchStatus, string> = {
  with_admin: 'bg-orange-100 text-orange-800',
  with_ict: 'bg-amber-100 text-amber-800',
  printed: 'bg-blue-100 text-blue-800',
  collected: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

export const ACTION_LABELS: Record<PrintAction, string> = {
  sent: 'Batch created and sent',
  forwarded: 'Forwarded to ICT',
  returned: 'Returned to INT',
  downloaded: 'Print file downloaded',
  printed: 'Marked printed',
  collected: 'Marked collected',
  cancelled: 'Cancelled',
  reprint_requested: 'Reprint requested',
}

/** Applicant statuses that may be put in a batch: approved, or already carded. */
export const BATCHABLE_STATUSES = ['APPROVED_GENERATING_ID', 'COMPLETED'] as const

/** Roles that may build a batch. INT sends it to Admin; Admin's own start with ICT. */
export const BATCH_SENDER_ROLES = ['int', 'admin'] as const
export function canSendBatches(role: string | null | undefined): boolean {
  return role === 'int' || role === 'admin'
}
/** Roles that may open the batch list and detail pages. */
export function canViewBatches(role: string | null | undefined): boolean {
  return role === 'ict' || role === 'int' || role === 'admin'
}
