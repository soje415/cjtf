import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createCustomer, createVirtualAccount, findCustomer, type VirtualAccount } from '@/lib/hyparrow-pay'
import { OFFICE_FEE_KOBO } from '@/lib/fees'

// Hyparrow expects a provider NAME here, not a numeric CBN/NIP code. Passing a
// numeric code surfaces as "interswitch VA creation failed". Use WEMA (default).
const BANK_CODE = process.env.HYPARROW_VA_BANK_CODE || 'WEMA'

/**
 * Ensure this office registration has a dedicated virtual account and return it
 * plus the current paid status. Idempotent — safe to call on mount and to poll.
 * Mirrors app/api/hyparrow/account but scoped to an office registration.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: reg } = await service
    .from('office_registrations')
    .select('id, registrant_id, status, first_name, last_name, email, phone_number, date_of_birth, hyparrow_customer_id, va_account_number, va_account_name, va_bank_name')
    .eq('id', params.id)
    .maybeSingle()

  if (!reg || reg.registrant_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const amount = OFFICE_FEE_KOBO
  const paid = reg.status !== 'PENDING_PAYMENT'
  if (paid) return NextResponse.json({ paid: true })

  if (reg.va_account_number) {
    return NextResponse.json({
      paid: false,
      amount,
      accountNumber: reg.va_account_number,
      accountName: reg.va_account_name,
      bankName: reg.va_bank_name,
    })
  }

  try {
    const email = reg.email || user.email!
    const phoneNumber = reg.phone_number || ''
    let customerId = reg.hyparrow_customer_id
    let va: VirtualAccount | null = null

    if (!customerId) {
      try {
        const customer = await createCustomer({
          firstName: reg.first_name || 'Registrant',
          lastName: reg.last_name || reg.id.slice(0, 8),
          email,
          phoneNumber,
          dateOfBirth: reg.date_of_birth || undefined,
        })
        customerId = customer.id
      } catch (err) {
        // Customer already exists upstream but our DB save didn't land — look it
        // up and reuse it (including any VA already issued on it) instead of
        // failing forever.
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
      await service.from('office_registrations').update({ hyparrow_customer_id: customerId }).eq('id', reg.id)
    }

    if (!va) {
      try {
        va = await createVirtualAccount(customerId, BANK_CODE)
      } catch (err) {
        if (!/already exists/i.test(err instanceof Error ? err.message : '')) throw err
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

    await service.from('office_registrations').update({
      va_account_number: va.accountNumber,
      va_account_name: va.accountName,
      va_bank_name: va.bankName,
      va_bank_code: va.bankCode,
      va_created_at: new Date().toISOString(),
    }).eq('id', reg.id)

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
