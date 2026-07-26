'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function CreateExecutiveForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/admin/create-executive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`Executive account created for ${form.fullName}`)
      setForm({ fullName: '', email: '', phone: '', password: '' })
      setOpen(false)
    } else {
      toast.error(data.error || 'Could not create account')
    }
    setLoading(false)
  }

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cjtf-blue'

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Executive / DSS Accounts</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : '+ New Executive Account'}
        </Button>
      </CardHeader>
      {open && (
        <CardContent>
          <p className="text-xs text-gray-500 mb-4">
            Creates a read-only oversight account with full visibility of the recruitment pipeline.
            Every record they view is logged.
          </p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <input className={inputCls} required value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)} placeholder="DSS Liaison Officer" />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <input className={inputCls} type="email" required value={form.email}
                onChange={(e) => set('email', e.target.value)} placeholder="officer@dss.gov.ng" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <input className={inputCls} type="tel" value={form.phone}
                onChange={(e) => set('phone', e.target.value)} placeholder="0801 234 5678" />
            </div>
            <div className="space-y-1">
              <Label>Temporary Password * (min 8 chars)</Label>
              <input className={inputCls} type="text" required minLength={8} value={form.password}
                onChange={(e) => set('password', e.target.value)} placeholder="Share securely" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} className="bg-cjtf-blue hover:bg-cjtf-blue-dark">
                {loading ? 'Creating…' : 'Create Executive Account'}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
