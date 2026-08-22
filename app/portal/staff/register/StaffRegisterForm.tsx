'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function StaffRegisterForm({ mode, initialMembershipType }: { mode: 'applicant' | 'office'; initialMembershipType?: 'new' | 'legacy' }) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [membershipType, setMembershipType] = useState<'new' | 'legacy'>(initialMembershipType ?? 'new')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, mode, membershipType }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not create the account')
        setSaving(false)
        return
      }
      toast.success('Account created — proceed to fill the form.')
      router.push(data.redirect)
    } catch {
      toast.error('Network error. Please try again.')
      setSaving(false)
    }
  }

  const isOffice = mode === 'office'

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-lg">
          {isOffice ? 'Register a new office' : 'Register a new applicant'}
        </CardTitle>
        <p className="text-sm text-gray-500">
          Create the {isOffice ? 'registrant' : 'applicant'}&apos;s record. You&apos;ll fill their full form next.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-1">
            <Label>Phone number *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0801 234 5678" required />
          </div>
          {!isOffice && (
            <div className="space-y-1">
              <Label>Membership type</Label>
              <select
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value as 'new' | 'legacy')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="new">New recruit</option>
                <option value="legacy">Existing / legacy member</option>
              </select>
            </div>
          )}
          <Button type="submit" disabled={saving} className="w-full bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Creating…' : 'Create & continue →'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
