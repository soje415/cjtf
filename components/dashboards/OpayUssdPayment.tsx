'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface Props {
  applicationId: string
  redirectPath?: string
}

interface UssdIssuer {
  bankName: string
  bankCode: string
}

/**
 * Alternate Hyparrow payment channels for the registration fee: OPay (redirect)
 * and USSD (dial code), shown alongside the bank-transfer virtual account.
 */
export default function OpayUssdPayment({ applicationId, redirectPath }: Props) {
  const router = useRouter()
  const [opayLoading, setOpayLoading] = useState(false)
  const [issuers, setIssuers] = useState<UssdIssuer[]>([])
  const [bankCode, setBankCode] = useState('')
  const [ussdLoading, setUssdLoading] = useState(false)
  const [ussdCode, setUssdCode] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  useEffect(() => stopPolling, [])

  function goDashboard() {
    toast.success('Payment received! The record has been forwarded for review.')
    setTimeout(() => router.push(redirectPath ?? '/portal/applicant/dashboard'), 1200)
  }

  function pollPaid(everyMs: number) {
    stopPolling()
    // Poll the VA/account endpoint's `paid` flag — the single source of truth
    // for "has the application left PENDING_PAYMENT", regardless of channel.
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/hyparrow/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId }),
        })
        const d = await res.json()
        if (d.paid) { stopPolling(); goDashboard() }
      } catch { /* keep polling */ }
    }, everyMs)
  }

  // OPay has a direct status endpoint, so confirm against it (no reliance on
  // the webhook to advance the application).
  function pollOpay(reference: string) {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/hyparrow/opay/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        })
        const d = await res.json()
        if (d.paid) { stopPolling(); goDashboard() }
      } catch { /* keep polling */ }
    }, 4000)
  }

  useEffect(() => {
    fetch('/api/hyparrow/ussd/issuers')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.issuers) && d.issuers.length) {
          setIssuers(d.issuers)
          setBankCode(d.issuers[0].bankCode)
        }
      })
      .catch(() => {})
  }, [])

  async function payOpay() {
    setOpayLoading(true)
    try {
      const res = await fetch('/api/hyparrow/opay/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not start OPay payment')
      window.open(d.redirectUrl, '_blank', 'noopener')
      pollOpay(d.reference)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start OPay payment')
    }
    setOpayLoading(false)
  }

  async function generateUssd() {
    if (!bankCode) { toast.error('Choose your bank first'); return }
    setUssdLoading(true)
    try {
      const res = await fetch('/api/hyparrow/ussd/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, bankCode }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not generate a USSD code')
      setUssdCode(d.ussdCode)
      pollPaid(5000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate a USSD code')
    }
    setUssdLoading(false)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pay online — OPay or USSD</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Pay with OPay</p>
          <Button onClick={payOpay} disabled={opayLoading} className="bg-cjtf-green hover:bg-cjtf-green-dark w-full">
            {opayLoading ? 'Opening OPay…' : 'Continue with OPay'}
          </Button>
          <p className="text-xs text-gray-500">
            You&apos;ll be redirected to OPay to complete the transfer. This page updates automatically once it&apos;s received.
          </p>
        </div>

        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Pay by USSD</p>
          <div className="flex gap-2">
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue"
            >
              {issuers.length === 0 && <option value="">Loading banks…</option>}
              {issuers.map((b) => (
                <option key={b.bankCode} value={b.bankCode}>{b.bankName}</option>
              ))}
            </select>
            <Button onClick={generateUssd} disabled={ussdLoading || !bankCode} className="bg-cjtf-blue hover:bg-cjtf-blue-dark text-white">
              {ussdLoading ? 'Generating…' : 'Generate code'}
            </Button>
          </div>
          {ussdCode && (
            <div className="rounded-lg border border-cjtf-green bg-green-50 p-4 text-center">
              <p className="text-xs text-gray-500">Dial this code on the phone linked to your bank:</p>
              <p className="text-2xl font-bold tracking-wider text-cjtf-green mt-1">{ussdCode}</p>
              <p className="text-xs text-gray-500 mt-2">Approve the payment, then wait — this page updates on its own.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
