'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Props {
  registrationId: string
  name: string
  officeName: string
}

interface AccountState {
  accountNumber: string
  accountName: string
  bankName: string
  amount: number // kobo
}

export default function OfficeVirtualAccountPayment({ registrationId, name, officeName }: Props) {
  const router = useRouter()
  const [account, setAccount] = useState<AccountState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const isDev = process.env.NODE_ENV !== 'production'

  const fetchAccount = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`/api/office/${registrationId}/account`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Could not generate a payment account.')
      return false
    }
    setError(null)
    if (data.paid) { setPaid(true); return true }
    setAccount({
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      bankName: data.bankName,
      amount: data.amount,
    })
    return false
  }, [registrationId])

  const polling = useRef(false)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    fetchAccount().then((isPaid) => {
      if (isPaid) { onPaid(); return }
      timer = setInterval(async () => {
        if (polling.current) return
        polling.current = true
        const isNowPaid = await fetchAccount().catch(() => false)
        polling.current = false
        if (isNowPaid) { clearInterval(timer); onPaid() }
      }, 8000)
    })
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPaid() {
    setPaid(true)
    toast.success('Payment received! Your registration has been forwarded for INT screening.')
    setTimeout(() => router.push('/portal/applicant/office'), 1500)
  }

  async function copy() {
    if (!account) return
    await navigator.clipboard.writeText(account.accountNumber)
    toast.success('Account number copied')
  }

  async function simulate() {
    setSimulating(true)
    try {
      const res = await fetch(`/api/office/${registrationId}/simulate`, { method: 'POST' })
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
            <p className="text-cjtf-green font-semibold">Payment received — taking you back to your registration…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Office Registration Fee</h1>
        <p className="text-gray-500 text-sm mt-1">
          Transfer the exact amount below to your dedicated account number for &ldquo;{officeName}&rdquo;. Your
          registration advances automatically once we receive it.
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
              <p className="text-3xl font-bold text-cjtf-green">₦{(account.amount / 100).toLocaleString()}</p>
              <p className="text-xs text-gray-400">Office registration fee.</p>
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
                <div><p className="text-xs text-gray-500">Bank</p><p className="font-medium text-gray-800">{account.bankName}</p></div>
                <div><p className="text-xs text-gray-500">Account Name</p><p className="font-medium text-gray-800">{account.accountName || name}</p></div>
              </div>
            </div>
            <p className="text-xs text-gray-400">This page updates on its own once your transfer is confirmed — no need to refresh.</p>
          </CardContent>
        </Card>
      )}

      {isDev && (
        <Button onClick={simulate} disabled={simulating} variant="outline" className="w-full border-dashed">
          {simulating ? 'Simulating…' : '🧪 Simulate payment (dev only)'}
        </Button>
      )}
    </div>
  )
}
