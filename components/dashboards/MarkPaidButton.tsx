'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * The "I have paid the fee" action: once the applicant has paid (cash or
 * transfer), ICT clicks this to confirm payment and advance the record past
 * PENDING_PAYMENT immediately, instead of waiting for the Hyparrow webhook.
 */
export default function MarkPaidButton({
  applicationId,
  officeRegistrationId,
  redirectPath,
}: {
  applicationId?: string
  officeRegistrationId?: string
  redirectPath?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function markPaid() {
    const ok = window.confirm(
      'Confirm the fee has been paid? This advances the record past payment immediately.'
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch('/api/hyparrow/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, officeRegistrationId }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('Payment confirmed — record advanced.')
        router.push(redirectPath || '/portal/ict/dashboard')
        router.refresh()
      } else {
        toast.error(d.error || 'Failed to confirm payment')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <Button
      type="button"
      onClick={markPaid}
      disabled={loading}
      className="w-full bg-cjtf-green hover:bg-cjtf-green-dark text-white"
    >
      {loading ? 'Confirming…' : 'I have paid the fee — continue ✓'}
    </Button>
  )
}
