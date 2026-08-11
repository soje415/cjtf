'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { paymentBypassEnabled, formatNaira } from '@/lib/fees'

interface Props {
  applicationId: string
  name: string
}

interface AccountState {
  accountNumber: string
  accountName: string
  bankName: string
  amount: number // kobo
}

export default function VirtualAccountPayment({ name }: Props) {
  const router = useRouter()
  const [account, setAccount] = useState<AccountState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const bypassEnabled = paymentBypassEnabled()

  // Fetch (or create) the virtual account, and report whether it's been paid.
  const fetchAccount = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/hyparrow/account', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Could not generate a payment account.')
      return false
    }
    setError(null)
    if (data.paid) {
      setPaid(true)
      return true
    }
    setAccount({
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      bankName: data.bankName,
      amount: data.amount,
    })
    return false
  }, [])

  // Initial load + poll for the incoming transfer every 8s.
  const polling = useRef(false)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    fetchAccount().then((isPaid) => {
      if (isPaid) {
        onPaid()
        return
      }
      timer = setInterval(async () => {
        if (polling.current) return
        polling.current = true
        const isNowPaid = await fetchAccount().catch(() => false)
        polling.current = false
        if (isNowPaid) {
          clearInterval(timer)
          onPaid()
        }
      }, 8000)
    })
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPaid() {
    setPaid(true)
    toast.success('Payment received! Your application has been forwarded for ICT verification.')
    setTimeout(() => router.push('/portal/applicant/dashboard'), 1500)
  }

  async function copy() {
    if (!account) return
    await navigator.clipboard.writeText(account.accountNumber)
    toast.success('Account number copied')
  }

  async function simulate() {
    setSimulating(true)
    try {
      const res = await fetch('/api/hyparrow/simulate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Simulation failed')
      onPaid()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setSimulating(false)
    }
  }

  if (paid) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-cjtf-green bg-cjtf-green-light">
          <CardContent className="p-6 text-center">
            <p className="text-cjtf-green font-semibold">Payment received — taking you to your dashboard…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Application Fee Payment</h1>
        <p className="text-gray-500 text-sm mt-1">
          Transfer the exact amount below to your personal account number. Your application
          advances automatically once we receive it.
        </p>
      </div>

      {error && (
        <Card className="border-red-300">
          <CardContent className="p-4 text-center space-y-3">
            <p className="text-red-600 text-sm">{error}</p>
            <Button onClick={() => fetchAccount()} variant="outline">Try again</Button>
          </CardContent>
        </Card>
      )}

      {!account && !error && (
        <Card><CardContent className="p-6 text-center text-gray-500">Generating your payment account…</CardContent></Card>
      )}

      {account && (
        <Card className="border-cjtf-green">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pay by Bank Transfer</CardTitle>
              <Badge className="bg-yellow-100 text-yellow-700">Awaiting transfer…</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="text-3xl font-bold text-cjtf-green">{formatNaira(account.amount)}</p>
              <p className="text-xs text-gray-400">One-off CJTF registration fee.</p>
            </div>

            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Account Number</p>
                  <p className="text-2xl font-bold tracking-wider text-gray-800">{account.accountNumber}</p>
                </div>
                <Button onClick={copy} variant="outline" size="sm">Copy</Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Bank</p>
                  <p className="font-medium text-gray-800">{account.bankName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Name</p>
                  <p className="font-medium text-gray-800">{account.accountName || name}</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              This page updates on its own once your transfer is confirmed — no need to refresh.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Testing bypass: completes the flow without a real transfer, for use while
          Hyparrow is being verified end to end. Shown only when
          NEXT_PUBLIC_ALLOW_PAYMENT_BYPASS=true — unset it once live payments are
          confirmed, or anyone can advance their own application without paying. */}
      {bypassEnabled && (
        <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-800">Testing bypass</p>
          <p className="text-xs text-amber-700">
            Marks this application as paid without a real transfer, so the rest of the flow can be
            tested. Remove before taking real payments.
          </p>
          <Button onClick={simulate} disabled={simulating} variant="outline" className="w-full border-dashed">
            {simulating ? 'Simulating…' : '🧪 Skip payment (testing)'}
          </Button>
        </div>
      )}
    </div>
  )
}
