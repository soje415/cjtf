'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Application } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// Applicant-submitted fields open to correction here. NIN/BVN are left out on
// purpose — those only ever change through the identity verification flow.
const FIELDS: { key: keyof Application; label: string }[] = [
  { key: 'first_name', label: 'First Name' },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'state_of_origin', label: 'State of Origin' },
  { key: 'lga_of_origin', label: 'LGA of Origin' },
  { key: 'residential_address', label: 'Residential Address' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'next_of_kin_name', label: 'Next of Kin Name' },
  { key: 'next_of_kin_phone', label: 'Next of Kin Phone' },
  { key: 'next_of_kin_relationship', label: 'Next of Kin Relationship' },
  { key: 'next_of_kin_address', label: 'Next of Kin Address' },
  { key: 'guarantor_name', label: 'Guarantor Name' },
  { key: 'guarantor_phone', label: 'Guarantor Phone' },
  { key: 'guarantor_address', label: 'Guarantor Address' },
  { key: 'sector_command', label: 'Sector Command' },
  { key: 'sub_sector', label: 'Sub Sector' },
  { key: 'unit', label: 'Unit' },
]

function fieldValues(application: Application): Record<string, string> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, (application[f.key] as string) ?? '']))
}

export default function ApplicantDetailsEditor({ application }: { application: Application }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => fieldValues(application))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  function openEdit() {
    setValues(fieldValues(application)) // reseed from the latest server data, not stale local state
    setEditing(true)
  }

  async function save() {
    if (!reason.trim()) {
      toast.error('Explain why you are correcting these details')
      return
    }
    const original = fieldValues(application)
    const updates: Record<string, string> = {}
    for (const f of FIELDS) {
      if (values[f.key] !== original[f.key]) updates[f.key] = values[f.key]
    }
    if (Object.keys(updates).length === 0) {
      toast.error('No changes made')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/applications/${application.id}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, note: reason }),
    })
    if (res.ok) {
      toast.success('Details corrected')
      setEditing(false)
      setReason('')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to save correction')
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={openEdit}>Correct Details</Button>
    )
  }

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-amber-50 border-amber-200">
      <p className="text-xs text-amber-800 font-medium">
        Correcting applicant-submitted details. NIN and BVN cannot be changed here.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Reason for correction * (required)</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. ICT mistyped the phone number"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Correction'}</Button>
      </div>
    </div>
  )
}
