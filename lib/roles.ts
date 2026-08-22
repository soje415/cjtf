// Centralised role helpers. Staff = anyone who isn't an applicant; the
// registration flow (creating accounts + filling forms on the public's behalf)
// is narrower — ICT and Admin only.

export const STAFF_ROLES = ['ict', 'int', 'admin', 'executive'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export const REGISTRATION_ROLES = ['ict', 'admin'] as const

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role)
}

/** Whether a role may register applicants/offices and edit on their behalf. */
export function canRegister(role: string | null | undefined): boolean {
  return role === 'ict' || role === 'admin'
}
