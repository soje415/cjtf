'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function VerifyPhoneForm({ maskedPhone, hasPhone, next }: { maskedPhone: string; hasPhone: boolean; next?: string | null }) {
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode() {
    setSending(true)
    const res = await fetch('/api/otp/send', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setSent(true)
      setCooldown(60)
      toast.success(`Verification code sent to ${maskedPhone}`)
    } else {
      toast.error(data.error || 'Could not send code')
      if (res.status === 429) setCooldown(15)
    }
    setSending(false)
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setVerifying(true)
    const res = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Phone number verified!')
      router.replace(next || '/portal/applicant/dashboard')
      router.refresh()
    } else {
      toast.error(data.error || 'Verification failed')
    }
    setVerifying(false)
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Verify your phone number</CardTitle>
          <p className="text-sm text-gray-500">
            We need to confirm <span className="font-medium">{maskedPhone || 'your phone number'}</span> before you can
            submit your application.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPhone ? (
            <p className="text-sm text-red-600">
              No phone number is on file for your account. Please contact the CJTF office.
            </p>
          ) : !sent ? (
            <Button onClick={sendCode} disabled={sending} className="w-full bg-cjtf-blue hover:bg-cjtf-blue-dark">
              {sending ? 'Sending…' : 'Send verification code'}
            </Button>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <div className="space-y-1">
                <Label>Enter the 6-digit code</Label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-cjtf-blue"
                />
              </div>
              <Button type="submit" disabled={verifying || code.length !== 6} className="w-full bg-cjtf-green hover:bg-cjtf-green-dark">
                {verifying ? 'Verifying…' : 'Verify'}
              </Button>
              <button
                type="button"
                onClick={sendCode}
                disabled={cooldown > 0 || sending}
                className="w-full text-sm text-cjtf-blue hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
