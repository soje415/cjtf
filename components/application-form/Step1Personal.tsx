'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FormData } from './ApplicationForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { getStates, getLgas } from 'nigeria-states-lga-select'
import { toast } from 'sonner'

const STATES: string[] = getStates()
const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Alhaji', 'Hajia', 'Chief']
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const EDUCATION = ['Primary', 'Secondary (SSCE)', 'OND/NCE', 'HND/Bachelor', 'Postgraduate', 'None']

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  appId: string | null
  ensureAppId: () => Promise<string | null>
  onNext: () => void
}

export default function Step1Personal({ form, update, saveProgress, saving, ensureAppId, onNext }: Props) {
  const lgas: string[] = form.state_of_origin ? getLgas(form.state_of_origin) : []

  const [method, setMethod] = useState<'nin' | 'bvn'>(
    (form.identity_verify_method as 'nin' | 'bvn') || 'nin'
  )
  const [number, setNumber] = useState(form.identity_verify_method === 'bvn' ? form.bvn : form.nin)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const verified = form.identity_verified
  const waived = form.identity_verify_waived

  async function handleVerify() {
    setVerifyError('')
    if (number.length !== 11) {
      setVerifyError(`${method.toUpperCase()} must be exactly 11 digits.`)
      return
    }
    const id = await ensureAppId()
    if (!id) {
      setVerifyError('Could not start your application. Please try again.')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/kyc/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: id, method, number }),
      })
      const json = await res.json()
      if (!res.ok) {
        setVerifyError(json.error || 'Verification failed. Check the number and try again.')
        setVerifying(false)
        return
      }
      const p = json.identity
      const fields: Partial<FormData> = {
        first_name: p.first_name,
        last_name: p.last_name,
        middle_name: p.middle_name || '',
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        identity_verified: true,
        identity_verify_method: method,
        identity_verify_waived: false,
      }
      if (method === 'nin') fields.nin = number
      else fields.bvn = number
      if (json.passport_photo_url) fields.passport_photo_url = json.passport_photo_url
      update(fields)
      toast.success('Identity verified ✓')
    } catch {
      setVerifyError('Could not reach the verification service. Please try again.')
    }
    setVerifying(false)
  }

  // PROTOTYPE: lets the applicant self-skip NIN/BVN verification when the
  // service doesn't come up, instead of getting stuck. Persists immediately
  // so it survives a step change. ICT still sees it as unverified/waived on
  // review. Re-tighten for production by removing this and requiring the
  // ICT/admin-only /waive-verification route instead.
  async function handleSkip() {
    update({ identity_verify_waived: true })
    await saveProgress({ identity_verify_waived: true })
    toast('Verification skipped — you can continue for now.')
  }

  function handleRetryVerification() {
    update({ identity_verify_waived: false })
    saveProgress({ identity_verify_waived: false })
  }

  async function handleNext() {
    await saveProgress({})
    onNext()
  }

  const REQUIRED: [keyof FormData, string][] = [
    ['title', 'Title'],
    ['first_name', 'First name'],
    ['last_name', 'Last name'],
    ['date_of_birth', 'Date of birth'],
    ['gender', 'Gender'],
    ['mother_maiden_name', "Mother's maiden name"],
    ['place_of_birth', 'Place of birth'],
    ['nationality', 'Nationality'],
    ['marital_status', 'Marital status'],
    ['occupation', 'Occupation'],
    ['education', 'Highest education'],
    ['state_of_origin', 'State of origin'],
    ['lga_of_origin', 'LGA of origin'],
  ]
  const missing = REQUIRED.filter(([k]) => !form[k]).map(([, label]) => label)
  const valid = (form.identity_verified || waived) && missing.length === 0

  // Only lock a KYC field if it actually came back with a value — otherwise the
  // applicant would be stuck with a blank, un-editable required field.
  const lock = (field: keyof FormData) => verified && !!form[field]

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Identity verification — NIN or BVN against the government record */}
        <div className={`rounded-lg border p-4 ${verified ? 'border-green-300 bg-green-50' : waived ? 'border-amber-300 bg-amber-50' : 'border-cjtf-green/40 bg-cjtf-green/5'}`}>
          {waived && !verified ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-800">Verification skipped</p>
                <p className="text-xs text-amber-700 mt-1">
                  You&apos;re continuing without NIN/BVN verification. Fill in your name, date of birth and
                  gender below yourself — staff will review this manually.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleRetryVerification}>
                Try verification again
              </Button>
            </div>
          ) : verified ? (
            <div className="flex items-start gap-4">
              {form.passport_photo_url && (
                <Image
                  src={form.passport_photo_url}
                  alt="Verified photo"
                  width={64}
                  height={64}
                  className="rounded-md object-cover border"
                  unoptimized
                />
              )}
              <div className="flex-1">
                <p className="font-semibold text-green-800 flex items-center gap-1">
                  ✓ Identity verified
                  <span className="text-xs font-normal text-green-700">
                    via {form.identity_verify_method?.toUpperCase()}
                  </span>
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  {form.first_name} {form.middle_name} {form.last_name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Your name, date of birth and gender are confirmed from your{' '}
                  {form.identity_verify_method?.toUpperCase()} and are locked. You can upload a clearer
                  passport photo in the Documents step if the verified photo is not sharp enough.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="font-semibold text-gray-800">Verify your identity</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                Enter your NIN or BVN. We confirm it against the national record and fill in your
                details automatically. This is required to submit your application.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={method} onValueChange={(v) => { setMethod(v as 'nin' | 'bvn'); setNumber(''); setVerifyError('') }}>
                  <SelectTrigger className="sm:w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nin">NIN</SelectItem>
                    <SelectItem value="bvn">BVN</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder={`11-digit ${method.toUpperCase()}`}
                  inputMode="numeric"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying || number.length !== 11}
                  className="bg-cjtf-green hover:bg-cjtf-green-dark"
                >
                  {verifying ? 'Verifying…' : 'Verify'}
                </Button>
              </div>
              {verifyError && <p className="text-sm text-red-600 mt-2">{verifyError}</p>}
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-gray-500 underline mt-2 hover:text-gray-700"
              >
                Verification service not working? Skip for now and continue.
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Select value={form.title} onValueChange={(v) => update({ title: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>First Name *</Label>
            <Input value={form.first_name} onChange={(e) => update({ first_name: e.target.value })} placeholder="John" disabled={lock('first_name')} />
          </div>
          <div className="space-y-1">
            <Label>Last Name *</Label>
            <Input value={form.last_name} onChange={(e) => update({ last_name: e.target.value })} placeholder="Doe" disabled={lock('last_name')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Middle Name (optional)</Label>
            <Input value={form.middle_name} onChange={(e) => update({ middle_name: e.target.value })} placeholder="James" disabled={lock('middle_name')} />
          </div>
          <div className="space-y-1">
            <Label>Mother&apos;s Maiden Name *</Label>
            <Input value={form.mother_maiden_name} onChange={(e) => update({ mother_maiden_name: e.target.value })} placeholder="Maiden surname" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Date of Birth *</Label>
            <Input type="date" value={form.date_of_birth} onChange={(e) => update({ date_of_birth: e.target.value })} disabled={lock('date_of_birth')} />
          </div>
          <div className="space-y-1">
            <Label>Gender *</Label>
            <Select value={form.gender} onValueChange={(v) => update({ gender: v ?? '' })} disabled={lock('gender')}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Place of Birth *</Label>
            <Input value={form.place_of_birth} onChange={(e) => update({ place_of_birth: e.target.value })} placeholder="Town / City" />
          </div>
          <div className="space-y-1">
            <Label>Nationality *</Label>
            <Input value={form.nationality} onChange={(e) => update({ nationality: e.target.value })} placeholder="Nigerian" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Marital Status *</Label>
            <Select value={form.marital_status} onValueChange={(v) => update({ marital_status: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{MARITAL.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Religion (optional)</Label>
            <Input value={form.religion} onChange={(e) => update({ religion: e.target.value })} placeholder="e.g. Christianity, Islam" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Blood Group (optional)</Label>
            <Select value={form.blood_group} onValueChange={(v) => update({ blood_group: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Height (optional)</Label>
            <Input value={form.height} onChange={(e) => update({ height: e.target.value })} placeholder="e.g. 1.75m" />
          </div>
          <div className="space-y-1">
            <Label>Distinguishing Marks (optional)</Label>
            <Input value={form.distinguishing_marks} onChange={(e) => update({ distinguishing_marks: e.target.value })} placeholder="Scars, tattoos…" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Occupation *</Label>
            <Input value={form.occupation} onChange={(e) => update({ occupation: e.target.value })} placeholder="e.g. Farmer, Trader" />
          </div>
          <div className="space-y-1">
            <Label>Highest Education *</Label>
            <Select value={form.education} onValueChange={(v) => update({ education: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{EDUCATION.map((ed) => <SelectItem key={ed} value={ed}>{ed}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>State of Origin *</Label>
            <Select value={form.state_of_origin} onValueChange={(v) => update({ state_of_origin: v ?? '', lga_of_origin: '' })}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>LGA of Origin *</Label>
            <Select value={form.lga_of_origin} onValueChange={(v) => update({ lga_of_origin: v ?? '' })} disabled={!form.state_of_origin}>
              <SelectTrigger>
                <SelectValue placeholder={form.state_of_origin ? 'Select LGA' : 'Select state first'} />
              </SelectTrigger>
              <SelectContent>{lgas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {!verified && !waived && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Verify your NIN or BVN above to continue, or skip it if the service isn&apos;t responding.
          </p>
        )}

        {(verified || waived) && missing.length > 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Please complete: {missing.join(', ')}.
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleNext} disabled={!valid || saving} className="bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Saving…' : 'Next Step →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
