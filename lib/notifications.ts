import type { createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/termii'
import { REGISTRATION_FEE_KOBO, OFFICE_FEE_KOBO } from '@/lib/fees'

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * Apply a bank-transfer credit received on an applicant's Hyparrow virtual
 * account. A transfer covering the registration fee clears it. Idempotent:
 * payment rows key off the Hyparrow transaction reference (UNIQUE on
 * payments.paystack_reference), so a replayed webhook is a no-op. On full
 * payment it calls notifyPaymentComplete() which atomically advances the
 * application to ICT verification.
 *
 * Returns { credited, advanced }.
 */
export async function creditVirtualAccountPayment(
  service: ServiceClient,
  params: { application: { id: string; applicant_id: string }; amountKobo: number; reference: string }
): Promise<{ credited: boolean; advanced: boolean }> {
  const { application, amountKobo, reference } = params

  // Underpayment: don't clear the fee. The persistent VA can receive a top-up later.
  if (amountKobo < REGISTRATION_FEE_KOBO) {
    return { credited: false, advanced: false }
  }

  // ON CONFLICT DO NOTHING on the unique reference makes a replayed webhook idempotent.
  await service.from('payments').upsert(
    [
      {
        application_id: application.id,
        applicant_id: application.applicant_id,
        type: 'registration',
        amount: REGISTRATION_FEE_KOBO,
        paystack_reference: `HYP-${reference}-REGISTRATION`,
        status: 'success',
        paid_at: new Date().toISOString(),
      },
    ],
    { onConflict: 'paystack_reference', ignoreDuplicates: true }
  )

  const advanced = await notifyPaymentComplete(service, application.id)
  return { credited: true, advanced }
}

/**
 * Apply a bank-transfer credit received on an office registrant's Hyparrow
 * virtual account. One transfer covering the office fee clears it and advances
 * the registration to INT screening. Idempotent via the unique reference column
 * on payments (paystack_reference); a replayed webhook is a no-op. Underpayment
 * does not clear the fee.
 *
 * Returns { credited, advanced }.
 */
export async function creditOfficeRegistrationPayment(
  service: ServiceClient,
  params: { registration: { id: string; registrant_id: string }; amountKobo: number; reference: string }
): Promise<{ credited: boolean; advanced: boolean }> {
  const { registration, amountKobo, reference } = params

  if (amountKobo < OFFICE_FEE_KOBO) {
    return { credited: false, advanced: false }
  }

  // Reuse the payments table; office_registration_id distinguishes these rows.
  const now = new Date().toISOString()
  await service.from('payments').upsert(
    [
      {
        office_registration_id: registration.id,
        applicant_id: registration.registrant_id,
        type: 'office',
        amount: OFFICE_FEE_KOBO,
        paystack_reference: `HYP-${reference}-OFFICE`,
        status: 'success',
        paid_at: now,
      },
    ],
    { onConflict: 'paystack_reference', ignoreDuplicates: true }
  )

  const advanced = await notifyOfficePaymentComplete(service, registration.id)
  return { credited: true, advanced }
}

/**
 * Atomically transition an office registration from PENDING_PAYMENT to
 * PENDING_INT_SCREENING and fire notifications. The conditional update on
 * status = PENDING_PAYMENT guarantees exactly one caller (browser verify vs
 * webhook) wins the transition. Returns true if this call performed it.
 */
export async function notifyOfficePaymentComplete(
  service: ServiceClient,
  registrationId: string
): Promise<boolean> {
  const { data: transitioned } = await service
    .from('office_registrations')
    .update({
      status: 'PENDING_INT_SCREENING',
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('status', 'PENDING_PAYMENT')
    .select('first_name, last_name, phone_number, office_name')
    .maybeSingle()

  if (!transitioned) return false

  const fullName = `${transitioned.first_name} ${transitioned.last_name}`

  if (transitioned.phone_number) {
    await sendSms(
      transitioned.phone_number,
      `CJTF Portal: Payment received for "${transitioned.office_name}", ${fullName}. Your office registration is now queued for INT screening.`
    ).catch(() => {})
  }

  // Alert INT officers that an office request is ready for screening.
  const { data: intOfficers } = await service.from('profiles').select('phone').eq('role', 'int')
  const intPhones = (intOfficers ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    intPhones,
    `CJTF Portal: Office registration "${transitioned.office_name}" (${fullName}) has paid and is ready for INT screening.`
  ).catch(() => {})

  return true
}

/**
 * Atomically transition an application from PENDING_PAYMENT to PENDING_ICT_VERIFICATION
 * and fire notifications. Both the Paystack verify call (from the applicant's browser)
 * and the Paystack webhook can race to confirm the final payment — the conditional
 * update on `status = PENDING_PAYMENT` guarantees exactly one caller wins the
 * transition, so the applicant confirmation and ICT alert are sent only once.
 *
 * Returns true if this call performed the transition (and sent the SMS).
 */
export async function notifyPaymentComplete(
  service: ServiceClient,
  applicationId: string
): Promise<boolean> {
  const { data: transitioned } = await service
    .from('applications')
    .update({
      status: 'PENDING_ICT_VERIFICATION',
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('status', 'PENDING_PAYMENT')
    .select('first_name, last_name, phone_number')
    .maybeSingle()

  if (!transitioned) return false

  const fullName = `${transitioned.first_name} ${transitioned.last_name}`

  // Confirm payment to the applicant
  if (transitioned.phone_number) {
    await sendSms(
      transitioned.phone_number,
      `CJTF Portal: Payment received in full, ${fullName}. Your application is now queued for ICT verification.`
    ).catch(() => {})
  }

  // Alert ICT officers that an application is ready for verification
  const { data: ictOfficers } = await service.from('profiles').select('phone').eq('role', 'ict')
  const ictPhones = (ictOfficers ?? []).map((p) => p.phone).filter(Boolean) as string[]
  await sendSms(
    ictPhones,
    `CJTF Portal: ${fullName} has completed payment and is ready for ICT verification.`
  ).catch(() => {})

  return true
}
