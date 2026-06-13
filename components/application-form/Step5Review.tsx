'use client'

import { FormData } from './ApplicationForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  appId: string | null
  onBack: () => void
  onSubmit: () => Promise<void>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-gray-500 w-40 flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value || '—'}</span>
    </div>
  )
}

export default function Step5Review({ form, saving, onBack, onSubmit }: Props) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-gray-500">Please review your information before submitting. Once submitted you cannot edit your form.</p>

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Personal</p>
          <Row label="Full Name" value={`${form.first_name} ${form.middle_name} ${form.last_name}`.trim()} />
          <Row label="Date of Birth" value={form.date_of_birth} />
          <Row label="Gender" value={form.gender} />
          <Row label="NIN" value={form.nin || '—'} />
          <Row label="State of Origin" value={form.state_of_origin} />
          <Row label="LGA" value={form.lga_of_origin} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Contact</p>
          <Row label="Phone" value={form.phone_number} />
          <Row label="Email" value={form.email} />
          <Row label="Address" value={form.residential_address} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Next of Kin</p>
          <Row label="Name" value={form.next_of_kin_name} />
          <Row label="Phone" value={form.next_of_kin_phone} />
          <Row label="Relationship" value={form.next_of_kin_relationship} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Documents</p>
          <Row label="Passport Photo" value={form.passport_photo_url ? '✓ Uploaded' : '✗ Missing'} />
          <Row label="ID Document" value={form.id_document_url ? '✓ Uploaded' : 'Not provided'} />
          <Row label="Birth Certificate" value={form.birth_cert_url ? '✓ Uploaded' : 'Not provided'} />
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button
            onClick={onSubmit}
            disabled={saving}
            className="bg-cjtf-gold text-cjtf-green hover:bg-cjtf-gold-dark font-semibold"
          >
            {saving ? 'Submitting…' : 'Submit Application →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
