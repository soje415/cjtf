'use client'

import { FormData } from './ApplicationForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  onNext: () => void
  onBack: () => void
}

export default function Step3NextOfKin({ form, update, saveProgress, saving, onNext, onBack }: Props) {
  async function handleNext() {
    await saveProgress({})
    onNext()
  }

  const valid = form.next_of_kin_name && form.next_of_kin_phone && form.next_of_kin_relationship

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-gray-500">Provide the details of your next of kin (emergency contact).</p>
        <div className="space-y-1">
          <Label>Full Name *</Label>
          <Input
            value={form.next_of_kin_name}
            onChange={(e) => update({ next_of_kin_name: e.target.value })}
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-1">
          <Label>Phone Number *</Label>
          <Input
            type="tel"
            value={form.next_of_kin_phone}
            onChange={(e) => update({ next_of_kin_phone: e.target.value })}
            placeholder="0802 345 6789"
          />
        </div>
        <div className="space-y-1">
          <Label>Relationship *</Label>
          <Input
            value={form.next_of_kin_relationship}
            onChange={(e) => update({ next_of_kin_relationship: e.target.value })}
            placeholder="e.g. Mother, Sibling, Spouse"
          />
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={handleNext} disabled={!valid || saving} className="bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Saving…' : 'Next Step →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
