export type Role = 'applicant' | 'ict' | 'int' | 'admin' | 'executive'

export type ApplicationStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PENDING_ICT_VERIFICATION'
  | 'PENDING_INT_SCREENING'
  | 'PENDING_ADMIN_APPROVAL'
  | 'PENDING_TRAINING'
  | 'APPROVED_GENERATING_ID'
  | 'COMPLETED'
  | 'REJECTED'

// 'legacy' applicants are already-recognised CJTF members being digitised
// into the portal — they pay a reduced fee and still go through the full
// ICT → INT → Admin pipeline.
export type MembershipType = 'new' | 'legacy'

// 'id_card' and 'training' are legacy: applicants now pay one 'registration' fee.
export type PaymentType = 'registration' | 'office' | 'id_card' | 'training'
export type PaymentStatus = 'pending' | 'success' | 'failed'

export type NoteAction =
  | 'ict_verified'
  | 'int_cleared'
  | 'admin_approved'
  | 'admin_rejected'
  | 'int_rejected'
  | 'id_generated'
  | 'training_completed'
  | 'resubmitted'
  | 'identity_waived'
  | 'rank_recommended'
  | 'rank_assigned'

export interface Profile {
  id: string
  role: Role
  full_name: string
  phone: string | null
  phone_verified: boolean
  created_at: string
}

export interface Application {
  id: string
  applicant_id: string
  status: ApplicationStatus
  membership_type: MembershipType
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
  // extended bio / KYC
  title: string | null
  mother_maiden_name: string | null
  place_of_birth: string | null
  nationality: string | null
  marital_status: string | null
  religion: string | null
  blood_group: string | null
  height: string | null
  distinguishing_marks: string | null
  occupation: string | null
  education: string | null
  state_of_residence: string | null
  lga_of_residence: string | null
  bvn: string | null
  means_of_id_type: string | null
  means_of_id_number: string | null
  next_of_kin_name: string
  next_of_kin_phone: string
  next_of_kin_relationship: string
  next_of_kin_address: string | null
  // guarantor
  guarantor_name: string | null
  guarantor_phone: string | null
  guarantor_title: string | null
  guarantor_address: string | null
  nin: string | null
  // identity verification (Hyparrow NIN/BVN KYC)
  identity_verified: boolean
  identity_verify_method: string | null
  identity_verified_at: string | null
  identity_verify_waived: boolean
  identity_verify_waived_by: string | null
  identity_verify_waived_reason: string | null
  passport_photo_url: string | null
  id_document_url: string | null
  birth_cert_url: string | null
  guarantor_form_url: string | null
  age_declaration_url: string | null
  // rank — INT recommends when clearing, Admin sets the final value when
  // approving, ICT prints `cjtf_rank` on the ID card. Named `cjtf_rank` rather
  // than `rank` because PostgREST reads a bare `rank` in a select list as the
  // ordered-set aggregate and rejects the request.
  recommended_rank: string | null
  cjtf_rank: string | null
  rank_assigned_by: string | null
  rank_assigned_at: string | null
  // legacy-member capture: self-reported at intake, cross-checked by
  // ICT/Admin against physical unit records at their existing review steps
  self_reported_rank: string | null
  legacy_id_number: string | null
  vouching_officer_name: string | null
  vouching_doc_url: string | null
  // deployment posting — printed on the back of the ID card
  sector_command: string | null
  sub_sector: string | null
  unit: string | null
  // signatures printed on the ID card back, captured by ICT at issue
  holder_signature_url: string | null
  officer_signature_url: string | null
  cjtf_id_number: string | null
  id_card_pdf_url: string | null
  submitted_at: string | null
  ict_verified_at: string | null
  int_cleared_at: string | null
  admin_approved_at: string | null
  trained_at: string | null
  completed_at: string | null
  rejected_by_role: Role | null
  rejected_at: string | null
  rejection_reason: string | null
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
  PENDING_TRAINING: 'Training',
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
  PENDING_TRAINING: 'bg-indigo-100 text-indigo-800',
  APPROVED_GENERATING_ID: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export const MEMBERSHIP_TYPE_LABELS: Record<MembershipType, string> = {
  new: 'New Recruit',
  legacy: 'Legacy Member',
}

export const MEMBERSHIP_TYPE_COLORS: Record<MembershipType, string> = {
  new: 'bg-gray-100 text-gray-700',
  legacy: 'bg-amber-100 text-amber-800',
}

// ============================================================
// Office Registration (CJTF Operational Permit) — separate flow
// ============================================================
export type OfficeStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PENDING_INT_SCREENING'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED_GENERATING_CERT'
  | 'COMPLETED'
  | 'REJECTED'

export interface OfficeRegistration {
  id: string
  registrant_id: string
  status: OfficeStatus
  title: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string | null
  gender: string | null
  phone_number: string
  email: string
  residential_address: string
  nin: string | null
  bvn: string | null
  identity_verified: boolean
  identity_verify_method: string | null
  identity_verified_at: string | null
  identity_verify_waived: boolean
  office_name: string
  office_designation: string | null
  area_council: string
  district: string
  office_address: string
  landmark: string | null
  office_photo_urls: string[]
  district_head_name: string | null
  endorsement_doc_url: string | null
  // deployment posting (collected only, not printed on the permit)
  sector_command: string | null
  sub_sector: string | null
  unit: string | null
  cert_number: string | null
  cert_pdf_url: string | null
  rejected_by_role: Role | null
  rejected_at: string | null
  rejection_reason: string | null
  submitted_at: string | null
  int_cleared_at: string | null
  admin_approved_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export const OFFICE_STATUS_LABELS: Record<OfficeStatus, string> = {
  DRAFT: 'Draft',
  PENDING_PAYMENT: 'Awaiting Payment',
  PENDING_INT_SCREENING: 'Intelligence Screening',
  PENDING_ADMIN_APPROVAL: 'Admin Approval',
  APPROVED_GENERATING_CERT: 'Generating Permit',
  COMPLETED: 'Permit Issued',
  REJECTED: 'Rejected',
}

export const OFFICE_STATUS_COLORS: Record<OfficeStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  PENDING_INT_SCREENING: 'bg-purple-100 text-purple-800',
  PENDING_ADMIN_APPROVAL: 'bg-orange-100 text-orange-800',
  APPROVED_GENERATING_CERT: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}
