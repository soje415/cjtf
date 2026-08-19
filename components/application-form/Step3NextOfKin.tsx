'use client'

import { FormData } from './ApplicationForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CJTF_RANKS } from '@/lib/ranks'

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  membershipType: 'new' | 'legacy'
  onNext: () => void
  onBack: () => void
}

export default function Step3NextOfKin({ form, update, saveProgress, saving, membershipType, onNext, onBack }: Props) {
  async function handleNext() {
    await saveProgress({})
    onNext()
  }

  const isLegacy = membershipType === 'legacy'

  const valid =
    form.next_of_kin_name &&
    form.next_of_kin_phone &&
    form.next_of_kin_relationship &&
    form.next_of_kin_address &&
    form.guarantor_name &&
    form.guarantor_phone &&
    form.guarantor_title &&
    form.guarantor_address &&
    (!isLegacy || (form.self_reported_rank && form.vouching_officer_name))

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-cjtf-green uppercase tracking-wide">Next of Kin (emergency contact)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.next_of_kin_name} onChange={(e) => update({ next_of_kin_name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1">
              <Label>Phone Number *</Label>
              <Input type="tel" value={form.next_of_kin_phone} onChange={(e) => update({ next_of_kin_phone: e.target.value })} placeholder="0802 345 6789" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Relationship *</Label>
              <Input value={form.next_of_kin_relationship} onChange={(e) => update({ next_of_kin_relationship: e.target.value })} placeholder="e.g. Mother, Spouse" />
            </div>
            <div className="space-y-1">
              <Label>Address *</Label>
              <Input value={form.next_of_kin_address} onChange={(e) => update({ next_of_kin_address: e.target.value })} placeholder="Next of kin address" />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <p className="text-sm font-semibold text-cjtf-green uppercase tracking-wide">Guarantor</p>
          <p className="text-xs text-gray-500">
            Provide a guarantor (e.g. a traditional ruler, ward/district head, or community leader) who can vouch for you.
            You will upload the signed guarantor form in the next step.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Guarantor Full Name *</Label>
              <Input value={form.guarantor_name} onChange={(e) => update({ guarantor_name: e.target.value })} placeholder="Guarantor's name" />
            </div>
            <div className="space-y-1">
              <Label>Guarantor Phone *</Label>
              <Input type="tel" value={form.guarantor_phone} onChange={(e) => update({ guarantor_phone: e.target.value })} placeholder="0803 456 7890" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Title / Position *</Label>
              <Input value={form.guarantor_title} onChange={(e) => update({ guarantor_title: e.target.value })} placeholder="e.g. District Head, Ward Head" />
            </div>
            <div className="space-y-1">
              <Label>Guarantor Address *</Label>
              <Input value={form.guarantor_address} onChange={(e) => update({ guarantor_address: e.target.value })} placeholder="Guarantor's address" />
            </div>
          </div>
        </div>

        {isLegacy && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-semibold text-cjtf-green uppercase tracking-wide">Existing Membership</p>
            <p className="text-xs text-gray-500">
              Since you&apos;re already a serving member, tell us your current rank and who at your unit can vouch for you —
              ICT and Command will cross-check this against unit records.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Current Rank *</Label>
                <Select value={form.self_reported_rank} onValueChange={(v) => update({ self_reported_rank: v ?? '' })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select your rank" /></SelectTrigger>
                  <SelectContent>
                    {CJTF_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Old CJTF ID / Rank Card Number</Label>
                <Input value={form.legacy_id_number} onChange={(e) => update({ legacy_id_number: e.target.value })} placeholder="If you have one" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Vouching Officer *</Label>
              <Input
                value={form.vouching_officer_name}
                onChange={(e) => update({ vouching_officer_name: e.target.value })}
                placeholder="Name of the unit/office head who can confirm your membership"
              />
            </div>
          </div>
        )}

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
