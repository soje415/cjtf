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
          <Row label="Full Name" value={`${form.title} ${form.first_name} ${form.middle_name} ${form.last_name}`.trim()} />
          <Row label="Date of Birth" value={form.date_of_birth} />
          <Row label="Gender" value={form.gender} />
          <Row label="Mother's Maiden Name" value={form.mother_maiden_name} />
          <Row label="Place of Birth" value={form.place_of_birth} />
          <Row label="Nationality" value={form.nationality} />
          <Row label="Marital Status" value={form.marital_status} />
          <Row label="Religion" value={form.religion} />
          <Row label="Blood Group" value={form.blood_group} />
          <Row label="Height" value={form.height} />
          <Row label="Distinguishing Marks" value={form.distinguishing_marks} />
          <Row label="Occupation" value={form.occupation} />
          <Row label="Education" value={form.education} />
          <Row label="NIN" value={form.nin} />
          <Row label="State / LGA of Origin" value={`${form.state_of_origin} / ${form.lga_of_origin}`} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Contact &amp; Residence</p>
          <Row label="Phone" value={form.phone_number} />
          <Row label="Email" value={form.email} />
          <Row label="State / LGA of Residence" value={`${form.state_of_residence} / ${form.lga_of_residence}`} />
          <Row label="Address" value={form.residential_address} />
          <Row label="BVN" value={form.bvn} />
          <Row label="Other Means of ID" value={form.means_of_id_type ? `${form.means_of_id_type} — ${form.means_of_id_number}` : ''} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Next of Kin</p>
          <Row label="Name" value={form.next_of_kin_name} />
          <Row label="Phone" value={form.next_of_kin_phone} />
          <Row label="Relationship" value={form.next_of_kin_relationship} />
          <Row label="Address" value={form.next_of_kin_address} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Guarantor</p>
          <Row label="Name" value={form.guarantor_name} />
          <Row label="Phone" value={form.guarantor_phone} />
          <Row label="Title / Position" value={form.guarantor_title} />
          <Row label="Address" value={form.guarantor_address} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold text-cjtf-green uppercase tracking-wide mb-1">Documents</p>
          <Row label="Passport Photo" value={form.passport_photo_url ? '✓ Uploaded' : '✗ Missing'} />
          <Row label="ID Document" value={form.id_document_url ? '✓ Uploaded' : 'Not provided'} />
          <Row label="Birth Certificate" value={form.birth_cert_url ? '✓ Uploaded' : 'Not provided'} />
          <Row label="Declaration of Age" value={form.age_declaration_url ? '✓ Uploaded' : '✗ Missing'} />
          <Row label="Guarantor Form" value={form.guarantor_form_url ? '✓ Uploaded' : '✗ Missing'} />
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
