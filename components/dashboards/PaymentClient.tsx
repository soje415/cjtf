'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const ID_CARD_FEE = Number(process.env.NEXT_PUBLIC_ID_CARD_FEE_KOBO ?? 500000)
const TRAINING_FEE = Number(process.env.NEXT_PUBLIC_TRAINING_FEE_KOBO ?? 1000000)

interface Props {
  applicationId: string
  email: string
  name: string
  idCardPaid: boolean
  trainingPaid: boolean
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

export default function PaymentClient({ applicationId, email, name, idCardPaid: initialIdCard, trainingPaid: initialTraining }: Props) {
  const router = useRouter()
  const [idCardPaid, setIdCardPaid] = useState(initialIdCard)
  const [trainingPaid, setTrainingPaid] = useState(initialTraining)
  const [loading, setLoading] = useState<'id_card' | 'training' | null>(null)

  async function pay(type: 'id_card' | 'training') {
    setLoading(type)
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment')

      await loadPaystackScript()

      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        email,
        amount: type === 'id_card' ? ID_CARD_FEE : TRAINING_FEE,
        ref: data.reference,
        metadata: { application_id: applicationId, payment_type: type, name },
        onClose: () => {
          toast.info('Payment window closed')
          setLoading(null)
        },
        callback: async (response) => {
          // Verify on server
          const verifyRes = await fetch('/api/paystack/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: response.reference }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.paid) {
            toast.success(`${type === 'id_card' ? 'ID Card' : 'Training'} fee payment successful!`)
            if (type === 'id_card') setIdCardPaid(true)
            else setTrainingPaid(true)
            if ((type === 'id_card' && trainingPaid) || (type === 'training' && idCardPaid)) {
              toast.success('All fees paid! Your application has been forwarded for ICT verification.')
              router.push('/portal/applicant/dashboard')
            }
          } else {
            toast.error('Payment verification failed')
          }
          setLoading(null)
        },
      })
      handler.openIframe()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Application Fees</h1>
        <p className="text-gray-500 text-sm mt-1">Two fees are required before your application proceeds</p>
      </div>

      <div className="grid gap-4">
        <Card className={idCardPaid ? 'border-cjtf-green' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">ID Card Fee</CardTitle>
              {idCardPaid
                ? <Badge className="bg-green-100 text-green-700">Paid ✓</Badge>
                : <Badge className="bg-yellow-100 text-yellow-700">Unpaid</Badge>
              }
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-cjtf-green mb-1">₦{(ID_CARD_FEE / 100).toLocaleString()}</p>
            <p className="text-sm text-gray-500 mb-3">Covers production of your official CJTF ID card with QR verification code</p>
            {!idCardPaid && (
              <Button
                onClick={() => pay('id_card')}
                disabled={!!loading}
                className="bg-cjtf-green hover:bg-cjtf-green-dark"
              >
                {loading === 'id_card' ? 'Opening payment…' : 'Pay ID Card Fee'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className={trainingPaid ? 'border-cjtf-green' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Training Fee</CardTitle>
              {trainingPaid
                ? <Badge className="bg-green-100 text-green-700">Paid ✓</Badge>
                : <Badge className="bg-yellow-100 text-yellow-700">Unpaid</Badge>
              }
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-cjtf-green mb-1">₦{(TRAINING_FEE / 100).toLocaleString()}</p>
            <p className="text-sm text-gray-500 mb-3">Covers CJTF orientation and training programme registration</p>
            {!trainingPaid && (
              <Button
                onClick={() => pay('training')}
                disabled={!!loading}
                className="bg-cjtf-green hover:bg-cjtf-green-dark"
              >
                {loading === 'training' ? 'Opening payment…' : 'Pay Training Fee'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {idCardPaid && trainingPaid && (
        <Card className="border-cjtf-green bg-cjtf-green-light">
          <CardContent className="p-4 text-center">
            <p className="text-cjtf-green font-semibold">All fees paid! Your application is now being processed.</p>
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
