'use client'

import { FormData } from './ApplicationForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  onNext: () => void
  onBack: () => void
}

export default function Step2Contact({ form, update, saveProgress, saving, onNext, onBack }: Props) {
  async function handleNext() {
    await saveProgress({})
    onNext()
  }

  const valid = form.phone_number && form.email && form.residential_address

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <Label>Phone Number *</Label>
          <Input
            type="tel"
            value={form.phone_number}
            onChange={(e) => update({ phone_number: e.target.value })}
            placeholder="0801 234 5678"
          />
        </div>
        <div className="space-y-1">
          <Label>Email Address *</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1">
          <Label>Residential Address *</Label>
          <Textarea
            value={form.residential_address}
            onChange={(e) => update({ residential_address: e.target.value })}
            placeholder="House number, street, town, state"
            rows={3}
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
