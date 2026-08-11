'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { REGISTRATION_FEE_KOBO, formatNaira } from '@/lib/fees'

/**
 * Paystack card/inline checkout for the registration fee.
 *
 * NOTE: not currently mounted anywhere — the live applicant payment flow is the
 * Hyparrow virtual account (see VirtualAccountPayment). Kept as the card-payment
 * path and updated alongside the fee change so it can't drift out of sync with
 * what the rest of the portal charges.
 */
interface Props {
  applicationId: string
  email: string
  name: string
  paid: boolean
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string; email: string; amount: number; ref: string;
        metadata?: object; onClose: () => void; callback: (res: { reference: string }) => void
      }) => { openIframe: () => void }
    }
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById('paystack-script')) { resolve(); return }
    const s = document.createElement('script')
    s.id = 'paystack-script'
    s.src = 'https://js.paystack.co/v1/inline.js'
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

export default function PaymentClient({ applicationId, email, name, paid: initialPaid }: Props) {
  const router = useRouter()
  const [paid, setPaid] = useState(initialPaid)
  const [loading, setLoading] = useState(false)

  async function pay() {
    setLoading(true)
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment')

      await loadPaystackScript()

      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        email,
        amount: REGISTRATION_FEE_KOBO,
        ref: data.reference,
        metadata: { application_id: applicationId, payment_type: 'registration', name },
        onClose: () => {
          toast.info('Payment window closed')
          setLoading(false)
        },
        callback: async (response) => {
          const verifyRes = await fetch('/api/paystack/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: response.reference }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.paid) {
            setPaid(true)
            toast.success('Registration fee paid! Your application has been forwarded for ICT verification.')
            router.push('/portal/applicant/dashboard')
          } else {
            toast.error('Payment verification failed')
          }
          setLoading(false)
        },
      })
      handler.openIframe()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Registration Fee</h1>
        <p className="text-gray-500 text-sm mt-1">One payment is required before your application proceeds</p>
      </div>

      <Card className={paid ? 'border-cjtf-green' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">CJTF Registration Fee</CardTitle>
            {paid
              ? <Badge className="bg-green-100 text-green-700">Paid ✓</Badge>
              : <Badge className="bg-yellow-100 text-yellow-700">Unpaid</Badge>
            }
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-cjtf-green mb-1">{formatNaira(REGISTRATION_FEE_KOBO)}</p>
          <p className="text-sm text-gray-500 mb-3">
            Covers your official CJTF ID card with QR verification code, and orientation/training registration
          </p>
          {!paid && (
            <Button onClick={pay} disabled={loading} className="bg-cjtf-green hover:bg-cjtf-green-dark">
              {loading ? 'Opening payment…' : 'Pay Registration Fee'}
            </Button>
          )}
        </CardContent>
      </Card>

      {paid && (
        <Card className="border-cjtf-green bg-cjtf-green-light">
          <CardContent className="p-4 text-center">
            <p className="text-cjtf-green font-semibold">Fee paid! Your application is now being processed.</p>
            <Button
              className="mt-3 bg-cjtf-green hover:bg-cjtf-green-dark"
              onClick={() => router.push('/portal/applicant/dashboard')}
            >
              View Application Status
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
