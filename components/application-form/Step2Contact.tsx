'use client'

import { useEffect, useMemo, useState } from 'react'
import { FormData } from './ApplicationForm'
import { normalizeSectorName, sectorKey } from '@/lib/sectors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { getStates, getLgas } from 'nigeria-states-lga-select'

const STATES: string[] = getStates()
const ID_TYPES = ["Voter's Card", "Driver's License", 'International Passport', 'NIN Slip', 'National ID Card']

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  onNext: () => void
  onBack: () => void
}

export default function Step2Contact({ form, update, saveProgress, saving, onNext, onBack }: Props) {
  const lgas: string[] = form.state_of_residence ? getLgas(form.state_of_residence) : []

  // Existing Sector Commands / Sub Sectors, offered as suggestions so applicants
  // reuse the established spelling (the print queue groups by these values).
  const [sectorOptions, setSectorOptions] = useState<{ name: string; subs: string[] }[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/sectors')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.sectors) setSectorOptions(j.sectors) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const subOptions = useMemo(() => {
    const match = sectorOptions.find((s) => sectorKey(s.name) === sectorKey(form.sector_command))
    // Known sector → its sub sectors; otherwise offer all of them.
    return match ? match.subs : [...new Set(sectorOptions.flatMap((s) => s.subs))].sort()
  }, [sectorOptions, form.sector_command])

  /** On blur: tidy the text and snap to an existing spelling when it matches one. */
  function tidySector(field: 'sector_command' | 'sub_sector', options: string[]) {
    const tidy = normalizeSectorName(form[field])
    const existing = options.find((o) => sectorKey(o) === sectorKey(tidy))
    const next = existing ?? tidy
    if (next !== form[field]) update({ [field]: next })
  }

  async function handleNext() {
    await saveProgress({
      sector_command: normalizeSectorName(form.sector_command),
      sub_sector: normalizeSectorName(form.sub_sector),
      unit: normalizeSectorName(form.unit),
    })
    onNext()
  }

  const valid =
    form.phone_number &&
    form.residential_address &&
    form.state_of_residence &&
    form.lga_of_residence &&
    form.sector_command &&
    form.sub_sector

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Phone Number *</Label>
            <Input type="tel" value={form.phone_number} onChange={(e) => update({ phone_number: e.target.value })} placeholder="0801 234 5678" />
          </div>
          <div className="space-y-1">
            <Label>Email Address (optional)</Label>
            <Input type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="you@example.com" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>State of Residence *</Label>
            <Select value={form.state_of_residence} onValueChange={(v) => update({ state_of_residence: v ?? '', lga_of_residence: '' })}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>LGA of Residence *</Label>
            <Select value={form.lga_of_residence} onValueChange={(v) => update({ lga_of_residence: v ?? '' })} disabled={!form.state_of_residence}>
              <SelectTrigger>
                <SelectValue placeholder={form.state_of_residence ? 'Select LGA' : 'Select state first'} />
              </SelectTrigger>
              <SelectContent>{lgas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Residential Address *</Label>
          <Textarea
            value={form.residential_address}
            onChange={(e) => update({ residential_address: e.target.value })}
            placeholder="House number, street, town"
            rows={3}
          />
        </div>

        <div className="border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Deployment / Posting</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Sector Command *</Label>
              <Input
                value={form.sector_command}
                list="sector-command-options"
                onChange={(e) => update({ sector_command: e.target.value })}
                onBlur={() => tidySector('sector_command', sectorOptions.map((s) => s.name))}
                placeholder="e.g. FCT Command"
                maxLength={80}
                autoComplete="off"
              />
              <datalist id="sector-command-options">
                {sectorOptions.map((s) => <option key={s.name} value={s.name} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>Sub Sector *</Label>
              <Input
                value={form.sub_sector}
                list="sub-sector-options"
                onChange={(e) => update({ sub_sector: e.target.value })}
                onBlur={() => tidySector('sub_sector', subOptions)}
                placeholder="e.g. Garki Sub Sector"
                maxLength={80}
                autoComplete="off"
              />
              <datalist id="sub-sector-options">
                {subOptions.map((s) => <option key={s} value={s} />)}
              </datalist>
              <p className="text-[11px] text-gray-400">Pick from the list if yours appears — it keeps ID batches grouped correctly.</p>
            </div>
            <div className="space-y-1">
              <Label>Unit (optional)</Label>
              <Input
                value={form.unit}
                onChange={(e) => update({ unit: e.target.value })}
                placeholder="e.g. Area Council Unit"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>BVN (optional)</Label>
            <Input
              value={form.bvn}
              onChange={(e) => update({ bvn: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              placeholder="11-digit BVN"
              maxLength={11}
            />
          </div>
          <div className="space-y-1">
            <Label>Other Means of ID (optional)</Label>
            <Select value={form.means_of_id_type} onValueChange={(v) => update({ means_of_id_type: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>ID Number (optional)</Label>
            <Input value={form.means_of_id_number} onChange={(e) => update({ means_of_id_number: e.target.value })} placeholder="ID number" />
          </div>
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
