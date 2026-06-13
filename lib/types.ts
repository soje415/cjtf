export type Role = 'applicant' | 'ict' | 'int' | 'admin'

export type ApplicationStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PENDING_ICT_VERIFICATION'
  | 'PENDING_INT_SCREENING'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED_GENERATING_ID'
  | 'COMPLETED'
  | 'REJECTED'

export type PaymentType = 'id_card' | 'training'
export type PaymentStatus = 'pending' | 'success' | 'failed'

export type NoteAction =
  | 'ict_verified'
  | 'int_cleared'
  | 'admin_approved'
  | 'admin_rejected'
  | 'int_rejected'
  | 'id_generated'

export interface Profile {
  id: string
  role: Role
  full_name: string
  phone: string | null
  created_at: string
}

export interface Application {
  id: string
  applicant_id: string
  status: ApplicationStatus
  first_name: string
  last_name: string
  middle_name: string | null
  date_of_birth: string
  gender: string
  state_of_origin: string
  lga_of_origin: string
  residential_address: string
  phone_number: string
  email: string
  next_of_kin_name: string
  next_of_kin_phone: string
  next_of_kin_relationship: string
  nin: string | null
  passport_photo_url: string | null
  id_document_url: string | null
  birth_cert_url: string | null
  cjtf_id_number: string | null
  id_card_pdf_url: string | null
  submitted_at: string | null
  ict_verified_at: string | null
  int_cleared_at: string | null
  admin_approved_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Payment {
  id: string
  application_id: string
  applicant_id: string
  type: PaymentType
  amount: number
  paystack_reference: string
  paystack_access_code: string | null
  status: PaymentStatus
  paid_at: string | null
  created_at: string
}

export interface ApplicationNote {
  id: string
  application_id: string
  staff_id: string
  note: string
  action: NoteAction
  created_at: string
  profiles?: Profile
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  PENDING_PAYMENT: 'Awaiting Payment',
  PENDING_ICT_VERIFICATION: 'ICT Verification',
  PENDING_INT_SCREENING: 'Intelligence Screening',
  PENDING_ADMIN_APPROVAL: 'Admin Approval',
  APPROVED_GENERATING_ID: 'Generating ID',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  PENDING_ICT_VERIFICATION: 'bg-blue-100 text-blue-800',
  PENDING_INT_SCREENING: 'bg-purple-100 text-purple-800',
  PENDING_ADMIN_APPROVAL: 'bg-orange-100 text-orange-800',
  APPROVED_GENERATING_ID: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}
