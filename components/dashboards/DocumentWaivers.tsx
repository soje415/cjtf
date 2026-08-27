'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Application } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const DOCS = [
  {
    key: 'guarantor_form' as const,
    label: 'Signed Guarantor Form',
    urlField: 'guarantor_form_url' as const,
    waivedField: 'guarantor_form_waived' as const,
    reasonField: 'guarantor_form_waived_reason' as const,
  },
  {
    key: 'age_declaration' as const,
    label: 'Declaration of Age',
    urlField: 'age_declaration_url' as const,
    waivedField: 'age_declaration_waived' as const,
    reasonField: 'age_declaration_waived_reason' as const,
  },
]

export default function DocumentWaivers({ application }: { application: Application }) {
  const router = useRouter()
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [waiving, setWaiving] = useState<string | null>(null)

  // Legacy members (already serving, re-registering) were never required to
  // provide these two documents — nothing to show or waive for them.
  if (application.membership_type === 'legacy') return null

  async function waive(key: string) {
    const reason = reasons[key]
    if (!reason?.trim()) {
      toast.error('Enter a reason to waive this document')
      return
    }
    setWaiving(key)
    const res = await fetch(`/api/applications/${application.id}/waive-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: key, reason }),
    })
    if (res.ok) {
      toast.success('Document requirement waived')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to waive')
    }
    setWaiving(null)
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Required Documents</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {DOCS.map((d) => {
          const uploaded = Boolean(application[d.urlField])
          const waived = Boolean(application[d.waivedField])
          if (uploaded) {
            return <p key={d.key} className="text-green-700 font-medium">✓ {d.label} provided</p>
          }
          if (waived) {
            return (
              <p key={d.key} className="text-amber-700 font-medium">
                ⚠ {d.label} waived
                {application[d.reasonField] && (
                  <span className="text-gray-500 font-normal ml-2">— {application[d.reasonField]}</span>
                )}
              </p>
            )
          }
          return (
            <div key={d.key} className="space-y-1">
              <p className="text-red-600 font-medium">✗ {d.label} not provided</p>
              <div className="flex gap-2">
                <Input
                  value={reasons[d.key] ?? ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [d.key]: e.target.value }))}
                  placeholder="Reason to waive (e.g. document lost, vouched for by unit head)"
                  className="flex-1"
                />
                <Button variant="outline" onClick={() => waive(d.key)} disabled={waiving === d.key}>
                  {waiving === d.key ? 'Waiving…' : 'Waive'}
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
