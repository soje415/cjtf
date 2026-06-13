'use client'

import { FormData } from './ApplicationForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { getStates, getLgas } from 'nigeria-states-lga-select'

const STATES: string[] = getStates()

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  onNext: () => void
}

export default function Step1Personal({ form, update, saveProgress, saving, onNext }: Props) {
  const lgas: string[] = form.state_of_origin ? getLgas(form.state_of_origin) : []

  function handleStateChange(state: string | null) {
    update({ state_of_origin: state ?? '', lga_of_origin: '' })
  }

  async function handleNext() {
    await saveProgress({})
    onNext()
  }

  const valid =
    form.first_name &&
    form.last_name &&
    form.date_of_birth &&
    form.gender &&
    form.state_of_origin &&
    form.lga_of_origin

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>First Name *</Label>
            <Input value={form.first_name} onChange={(e) => update({ first_name: e.target.value })} placeholder="John" />
          </div>
          <div className="space-y-1">
            <Label>Last Name *</Label>
            <Input value={form.last_name} onChange={(e) => update({ last_name: e.target.value })} placeholder="Doe" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Middle Name (optional)</Label>
          <Input value={form.middle_name} onChange={(e) => update({ middle_name: e.target.value })} placeholder="James" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Date of Birth *</Label>
            <Input type="date" value={form.date_of_birth} onChange={(e) => update({ date_of_birth: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Gender *</Label>
            <Select value={form.gender} onValueChange={(v) => update({ gender: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>NIN (National Identification Number)</Label>
          <Input
            value={form.nin}
            onChange={(e) => update({ nin: e.target.value.replace(/\D/g, '').slice(0, 11) })}
            placeholder="11-digit NIN"
            maxLength={11}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>State of Origin *</Label>
            <Select value={form.state_of_origin} onValueChange={handleStateChange}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>LGA of Origin *</Label>
            <Select
              value={form.lga_of_origin}
              onValueChange={(v) => update({ lga_of_origin: v ?? '' })}
              disabled={!form.state_of_origin}
            >
              <SelectTrigger>
                <SelectValue placeholder={form.state_of_origin ? 'Select LGA' : 'Select state first'} />
              </SelectTrigger>
              <SelectContent>
                {lgas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleNext} disabled={!valid || saving} className="bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Saving…' : 'Next Step →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
