import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createCustomer, createVirtualAccount, findCustomer, type VirtualAccount } from '@/lib/hyparrow-pay'
import { feeForMembershipType } from '@/lib/fees'

// Hyparrow expects a provider NAME here, not a numeric CBN/NIP code. Passing a
// numeric code surfaces as "interswitch VA creation failed". Use WEMA (default).
const BANK_CODE = process.env.HYPARROW_VA_BANK_CODE || 'WEMA'

/**
 * Ensure the applicant has a dedicated virtual account and return it, plus the
 * current paid status. Idempotent — safe to call on mount and to poll.
 */
export async function POST() {
  const supabase = createClient()
  const { data: { session: _session } } = await supabase.auth.getSession()
  const user = _session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: app } = await service
    .from('applications')
    .select(
      'id, status, applicant_id, membership_type, first_name, last_name, middle_name, email, phone_number, date_of_birth, hyparrow_customer_id, va_account_number, va_account_name, va_bank_name'
    )
    .eq('applicant_id', user.id)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'No application found' }, { status: 404 })

  const amount = feeForMembershipType(app.membership_type)

  // Once payment has been received the application leaves PENDING_PAYMENT.
  const paid = app.status !== 'PENDING_PAYMENT'
  if (paid) {
    return NextResponse.json({ paid: true })
  }

  // Return the existing account if we've already issued one.
  if (app.va_account_number) {
    return NextResponse.json({
      paid: false,
      amount,
      accountNumber: app.va_account_number,
      accountName: app.va_account_name,
      bankName: app.va_bank_name,
    })
  }

  const email = app.email || user.email!
  const phoneNumber = app.phone_number || ''

  // Issue a new virtual account: create the Hyparrow customer (once) then the NUBAN.
  // Both steps are idempotent-recoverable — if a prior attempt created the
  // customer/VA upstream but our DB save didn't land, "already exists" surfaces;
  // we look the record up and reuse it instead of failing forever.
  try {
    let customerId = app.hyparrow_customer_id
    // A VA carried over from a recovered customer lookup, if any.
    let va: VirtualAccount | null = null

    if (!customerId) {
      try {
        const customer = await createCustomer({
          firstName: app.first_name || 'Applicant',
          lastName: app.last_name || app.id.slice(0, 8),
          email,
          phoneNumber,
          dateOfBirth: app.date_of_birth || undefined,
        })
        customerId = customer.id
      } catch (err) {
        if (!/already exists/i.test(err instanceof Error ? err.message : '')) throw err
        const found = await findCustomer({ email, phoneNumber })
        if (!found) throw err
        customerId = found.id
        if (found.accountNumber) {
          va = {
            accountNumber: found.accountNumber,
            accountName: found.accountName || '',
            bankName: found.bankName || '',
            bankCode: found.bankCode || BANK_CODE,
          }
        }
      }
      await service
        .from('applications')
        .update({ hyparrow_customer_id: customerId })
        .eq('id', app.id)
    }

    if (!va) {
      try {
        va = await createVirtualAccount(customerId, BANK_CODE)
      } catch (err) {
        if (!/already exists/i.test(err instanceof Error ? err.message : '')) throw err
        // VA exists upstream but we lost it — recover it from the customer record.
        const found = await findCustomer({ email, phoneNumber })
        if (!found?.accountNumber) throw err
        va = {
          accountNumber: found.accountNumber,
          accountName: found.accountName || '',
          bankName: found.bankName || '',
          bankCode: found.bankCode || BANK_CODE,
        }
      }
    }

    await service
      .from('applications')
      .update({
        va_account_number: va.accountNumber,
        va_account_name: va.accountName,
        va_bank_name: va.bankName,
        va_bank_code: va.bankCode,
        va_created_at: new Date().toISOString(),
      })
      .eq('id', app.id)

    return NextResponse.json({
      paid: false,
      amount,
      accountNumber: va.accountNumber,
      accountName: va.accountName,
      bankName: va.bankName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate a payment account.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
