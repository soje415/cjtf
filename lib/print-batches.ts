export type PrintStatus = 'not_queued' | 'queued' | 'printed' | 'collected'
export type BatchStatus = 'sent' | 'printed' | 'collected' | 'cancelled'
export type PrintAction = 'sent' | 'downloaded' | 'printed' | 'collected' | 'cancelled' | 'reprint_requested'

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
  printed_by: string | null
  printed_at: string | null
  collected_by: string | null
  collected_at: string | null
  created_at: string
  updated_at: string
}

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  sent: 'Awaiting print',
  printed: 'Printed',
  collected: 'Collected',
  cancelled: 'Cancelled',
}

export const BATCH_STATUS_COLORS: Record<BatchStatus, string> = {
  sent: 'bg-amber-100 text-amber-800',
  printed: 'bg-blue-100 text-blue-800',
  collected: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

export const ACTION_LABELS: Record<PrintAction, string> = {
  sent: 'Sent to ICT for printing',
  downloaded: 'Print file downloaded',
  printed: 'Marked printed',
  collected: 'Marked collected',
  cancelled: 'Cancelled',
  reprint_requested: 'Reprint requested',
}

/** Roles that may send cards for printing / cancel / request a reprint. */
export const BATCH_SENDER_ROLES = ['int', 'admin'] as const
export function canSendBatches(role: string | null | undefined): boolean {
  return role === 'int' || role === 'admin'
}
/** Roles that may open the batch list and detail pages. */
export function canViewBatches(role: string | null | undefined): boolean {
  return role === 'ict' || role === 'int' || role === 'admin'
}
