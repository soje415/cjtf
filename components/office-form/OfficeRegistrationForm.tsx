'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OfficeRegistration } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { officeChecksRelaxed } from '@/lib/pilot'

const STEP_TITLES = ['Registrant & Identity', 'Office Details', 'Photos & Endorsement', 'Review & Submit']
const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Alhaji', 'Hajia', 'Chief']
const DESIGNATIONS = ['Zonal Office', 'Area Council Office', 'District Office', 'Ward Post', 'Operational Base', 'Other']

export interface Locality { area_council: string; districts: string[] }

type FormState = {
  title: string
  first_name: string
  middle_name: string
  last_name: string
  date_of_birth: string
  gender: string
  phone_number: string
  email: string
  residential_address: string
  nin: string
  bvn: string
  identity_verified: boolean
  identity_verify_method: string
  identity_verify_waived: boolean
  office_name: string
  office_designation: string
  area_council: string
  district: string
  office_address: string
  landmark: string
  office_photo_urls: string[]
  district_head_name: string
  endorsement_doc_url: string
}

function initial(reg: OfficeRegistration | null): FormState {
  return {
    title: reg?.title ?? '',
    first_name: reg?.first_name ?? '',
    middle_name: reg?.middle_name ?? '',
    last_name: reg?.last_name ?? '',
    date_of_birth: reg?.date_of_birth ?? '',
    gender: reg?.gender ?? '',
    phone_number: reg?.phone_number ?? '',
    email: reg?.email ?? '',
    residential_address: reg?.residential_address ?? '',
    nin: reg?.nin ?? '',
    bvn: reg?.bvn ?? '',
    identity_verified: reg?.identity_verified ?? false,
    identity_verify_method: reg?.identity_verify_method ?? '',
    identity_verify_waived: reg?.identity_verify_waived ?? false,
    office_name: reg?.office_name ?? '',
    office_designation: reg?.office_designation ?? '',
    area_council: reg?.area_council ?? '',
    district: reg?.district ?? '',
    office_address: reg?.office_address ?? '',
    landmark: reg?.landmark ?? '',
    office_photo_urls: reg?.office_photo_urls ?? [],
    district_head_name: reg?.district_head_name ?? '',
    endorsement_doc_url: reg?.endorsement_doc_url ?? '',
  }
}

export default function OfficeRegistrationForm({
  existing,
  localities,
}: {
  existing: OfficeRegistration | null
  localities: Locality[]
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [regId, setRegId] = useState<string | null>(existing?.id ?? null)
  const [form, setForm] = useState<FormState>(initial(existing))

  function update(fields: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...fields }))
  }

  async function ensureRegId(): Promise<string | null> {
    if (regId) return regId
    try {
      const res = await fetch('/api/office', { method: 'POST' })
      const json = await res.json()
      const id = json.registration?.id ?? null
      if (id) setRegId(id)
      return id
    } catch {
      return null
    }
  }

  async function saveProgress(fields: Partial<FormState>): Promise<boolean> {
    setSaving(true)
    const merged = { ...form, ...fields }
    setForm(merged)
    let ok = false
    try {
      let id = regId
      if (!id) id = await ensureRegId()
      if (id) {
        const res = await fetch(`/api/office/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        })
        ok = res.ok
        if (!ok) {
          const json = await res.json().catch(() => ({}))
          toast.error(json.error ?? 'Failed to save progress.')
        }
      }
    } catch {
      toast.error('Failed to save progress. Check your connection.')
    }
    setSaving(false)
    return ok
  }

  async function handleSubmit() {
    if (!regId) return
    setSaving(true)
    try {
      const patchRes = await fetch(`/api/office/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!patchRes.ok) {
        const patchJson = await patchRes.json().catch(() => ({}))
        toast.error(patchJson.error ?? 'Failed to save your details before submitting.')
        setSaving(false)
        return
      }
      const res = await fetch(`/api/office/${regId}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to submit registration')
        setSaving(false)
        return
      }
      toast.success('Registration submitted! Please pay the registration fee to continue.')
      router.push('/portal/applicant/office/payment')
    } catch {
      toast.error('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">CJTF Office Registration</h1>
        <p className="text-gray-500 text-sm mt-1">
          Apply for an Operational Permit to open and operate a CJTF office in the FCT and its environs.
        </p>
        <p className="text-gray-500 text-sm mt-1">Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}</p>
        <div className="mt-3 flex gap-1">
          {STEP_TITLES.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-cjtf-green' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <StepRegistrant form={form} update={update} saving={saving} ensureRegId={ensureRegId} saveProgress={saveProgress}
          onNext={async () => { if (await saveProgress({})) setStep(1) }} />
      )}
      {step === 1 && (
        <StepOffice form={form} update={update} saving={saving} localities={localities}
          onBack={() => setStep(0)} onNext={async () => { if (await saveProgress({})) setStep(2) }} />
      )}
      {step === 2 && (
        <StepPhotos form={form} update={update} saving={saving} ensureRegId={ensureRegId}
          onBack={() => setStep(1)} onNext={async () => { if (await saveProgress({})) setStep(3) }} />
      )}
      {step === 3 && (
        <StepReview form={form} saving={saving} onBack={() => setStep(2)} onSubmit={handleSubmit} />
      )}
    </div>
  )
}

// ── Step 0: registrant + identity verification ──
function StepRegistrant({ form, update, saving, ensureRegId, saveProgress, onNext }: {
  form: FormState; update: (f: Partial<FormState>) => void; saving: boolean
  ensureRegId: () => Promise<string | null>; saveProgress: (f: Partial<FormState>) => Promise<boolean>; onNext: () => void
}) {
  const [method, setMethod] = useState<'nin' | 'bvn'>((form.identity_verify_method as 'nin' | 'bvn') || 'nin')
  const [number, setNumber] = useState(form.identity_verify_method === 'bvn' ? form.bvn : form.nin)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const verified = form.identity_verified
  const waived = form.identity_verify_waived
  const lock = (field: keyof FormState) => verified && !!form[field]

  async function handleVerify() {
    setVerifyError('')
    if (number.length !== 11) { setVerifyError(`${method.toUpperCase()} must be exactly 11 digits.`); return }
    const id = await ensureRegId()
    if (!id) { setVerifyError('Could not start your registration. Please try again.'); return }
    setVerifying(true)
    try {
      const res = await fetch('/api/office/kyc/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regId: id, method, number }),
      })
      const json = await res.json()
      if (!res.ok) { setVerifyError(json.error || 'Verification failed.'); setVerifying(false); return }
      const p = json.identity
      const fields: Partial<FormState> = {
        first_name: p.first_name, last_name: p.last_name, middle_name: p.middle_name || '',
        date_of_birth: p.date_of_birth, gender: p.gender,
        identity_verified: true, identity_verify_method: method, identity_verify_waived: false,
      }
      if (method === 'nin') fields.nin = number; else fields.bvn = number
      update(fields)
      toast.success('Identity verified ✓')
    } catch {
      setVerifyError('Could not reach the verification service. Please try again.')
    }
    setVerifying(false)
  }

  // Self-serve identity waiver was removed for production: identity must be
  // verified (NIN/BVN). The registrant can no longer set identity_verify_waived
  // themselves (the field is no longer in the PATCH allowlist either).
  function handleRetryVerification() {
    update({ identity_verify_waived: false })
    saveProgress({ identity_verify_waived: false })
  }

  const REQUIRED: [keyof FormState, string][] = [
    ['title', 'Title'], ['first_name', 'First name'], ['last_name', 'Last name'],
    ['phone_number', 'Phone number'], ['residential_address', 'Residential address'],
  ]
  const missing = REQUIRED.filter(([k]) => !form[k]).map(([, l]) => l)
  const valid = verified && missing.length === 0

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className={`rounded-lg border p-4 ${verified ? 'border-green-300 bg-green-50' : waived ? 'border-amber-300 bg-amber-50' : 'border-cjtf-green/40 bg-cjtf-green/5'}`}>
          {waived && !verified ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-800">Verification skipped</p>
                <p className="text-xs text-amber-700 mt-1">
                  You&apos;re continuing without NIN/BVN verification. Fill in your name, date of birth and
                  gender yourself — staff will review this manually.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleRetryVerification}>
                Try verification again
              </Button>
            </div>
          ) : verified ? (
            <div>
              <p className="font-semibold text-green-800">✓ Identity verified <span className="text-xs font-normal text-green-700">via {form.identity_verify_method?.toUpperCase()}</span></p>
              <p className="text-sm text-gray-700 mt-1">{form.first_name} {form.middle_name} {form.last_name}</p>
              <p className="text-xs text-gray-500 mt-1">Your name, date of birth and gender are confirmed and locked.</p>
            </div>
          ) : (
            <>
              <p className="font-semibold text-gray-800">Verify your identity</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Enter your NIN or BVN. This is required before you can submit.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={method} onValueChange={(v) => { setMethod(v as 'nin' | 'bvn'); setNumber(''); setVerifyError('') }}>
                  <SelectTrigger className="sm:w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="nin">NIN</SelectItem><SelectItem value="bvn">BVN</SelectItem></SelectContent>
                </Select>
                <Input value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder={`11-digit ${method.toUpperCase()}`} inputMode="numeric" className="flex-1" />
                <Button type="button" onClick={handleVerify} disabled={verifying || number.length !== 11} className="bg-cjtf-green hover:bg-cjtf-green-dark">
                  {verifying ? 'Verifying…' : 'Verify'}
                </Button>
              </div>
              {verifyError && <p className="text-sm text-red-600 mt-2">{verifyError}</p>}
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
          <div className="space-y-1"><Label>First Name *</Label>
            <Input value={form.first_name} onChange={(e) => update({ first_name: e.target.value })} disabled={lock('first_name')} /></div>
          <div className="space-y-1"><Label>Last Name *</Label>
            <Input value={form.last_name} onChange={(e) => update({ last_name: e.target.value })} disabled={lock('last_name')} /></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Phone Number *</Label>
            <Input value={form.phone_number} onChange={(e) => update({ phone_number: e.target.value })} placeholder="0801 234 5678" /></div>
          <div className="space-y-1"><Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="you@example.com" /></div>
        </div>

        <div className="space-y-1"><Label>Residential Address *</Label>
          <Textarea value={form.residential_address} onChange={(e) => update({ residential_address: e.target.value })} placeholder="Your home address" /></div>

        {!verified && !waived && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Verify your NIN or BVN above to continue.
          </p>
        )}
        {(verified || waived) && missing.length > 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">Please complete: {missing.join(', ')}.</p>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onNext} disabled={!valid || saving} className="bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Saving…' : 'Next Step →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Step 1: office details ──
function StepOffice({ form, update, saving, localities, onBack, onNext }: {
  form: FormState; update: (f: Partial<FormState>) => void; saving: boolean
  localities: Locality[]; onBack: () => void; onNext: () => void
}) {
  const districts = localities.find((l) => l.area_council === form.area_council)?.districts ?? []
  const REQUIRED: [keyof FormState, string][] = [
    ['office_name', 'Office name'], ['area_council', 'Area council'],
    ['district', 'District'], ['office_address', 'Office address'],
  ]
  const missing = REQUIRED.filter(([k]) => !form[k]).map(([, l]) => l)

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Office Name *</Label>
            <Input value={form.office_name} onChange={(e) => update({ office_name: e.target.value })} placeholder="e.g. Garki Zonal Office" /></div>
          <div className="space-y-1"><Label>Office Type</Label>
            <Select value={form.office_designation} onValueChange={(v) => update({ office_designation: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{DESIGNATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Area Council *</Label>
            <Select value={form.area_council} onValueChange={(v) => update({ area_council: v ?? '', district: '' })}>
              <SelectTrigger><SelectValue placeholder="Select area council" /></SelectTrigger>
              <SelectContent>{localities.map((l) => <SelectItem key={l.area_council} value={l.area_council}>{l.area_council}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>District / Locality *</Label>
            <Select value={form.district} onValueChange={(v) => update({ district: v ?? '' })} disabled={!form.area_council}>
              <SelectTrigger><SelectValue placeholder={form.area_council ? 'Select district' : 'Select area council first'} /></SelectTrigger>
              <SelectContent>{districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>

        <div className="space-y-1"><Label>Office Address *</Label>
          <Textarea value={form.office_address} onChange={(e) => update({ office_address: e.target.value })} placeholder="Full street address of the office" /></div>
        <div className="space-y-1"><Label>Nearest Landmark (optional)</Label>
          <Input value={form.landmark} onChange={(e) => update({ landmark: e.target.value })} placeholder="e.g. Opposite Kaita Plaza" /></div>

        {missing.length > 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">Please complete: {missing.join(', ')}.</p>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={onNext} disabled={missing.length > 0 || saving} className="bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Saving…' : 'Next Step →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Step 2: office-space photos + district-head endorsement ──
function StepPhotos({ form, update, saving, ensureRegId, onBack, onNext }: {
  form: FormState; update: (f: Partial<FormState>) => void; saving: boolean
  ensureRegId: () => Promise<string | null>; onBack: () => void; onNext: () => void
}) {
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const id = await ensureRegId()
    if (!id) { toast.error('Please complete the earlier steps first.'); return }
    setUploadingPhoto(true)
    try {
      const res = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, applicationId: id }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to get upload URL'); setUploadingPhoto(false); return }
      const put = await fetch(json.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) { toast.error('Upload failed. Please try again.'); setUploadingPhoto(false); return }
      update({ office_photo_urls: [...form.office_photo_urls, json.publicUrl] })
      toast.success('Photo uploaded')
    } catch { toast.error('Upload failed. Check your connection.') }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  function removePhoto(url: string) {
    update({ office_photo_urls: form.office_photo_urls.filter((u) => u !== url) })
  }

  async function handleEndorsement(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const id = await ensureRegId()
    if (!id) { toast.error('Please complete the earlier steps first.'); return }
    setUploadingDoc(true)
    try {
      const res = await fetch(`/api/office/${id}/upload-endorsement`, {
        method: 'POST', headers: { 'Content-Type': file.type }, body: file,
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Upload failed'); setUploadingDoc(false); return }
      update({ endorsement_doc_url: json.url })
      toast.success('Endorsement uploaded')
    } catch { toast.error('Upload failed. Check your connection.') }
    setUploadingDoc(false)
    e.target.value = ''
  }

  const photosDone = form.office_photo_urls.length > 0
  // Pilot: the photo stops blocking the step, matching the server-side gate in
  // app/api/office/[id]/route.ts. See lib/pilot.ts.
  const photosRelaxed = officeChecksRelaxed()

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <Label>Office-Space Photos *</Label>
          <p className="text-xs text-gray-500">Upload clear photos of the office space (exterior and interior). At least one is required; staff verify these online.</p>
          <input type="file" accept="image/*" onChange={handlePhoto} disabled={uploadingPhoto}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-cjtf-green file:text-white file:text-xs file:cursor-pointer hover:file:bg-cjtf-green-dark" />
          {uploadingPhoto && <span className="text-xs text-gray-500">Uploading…</span>}
          {photosDone && (
            <ul className="mt-2 space-y-1">
              {form.office_photo_urls.map((u, i) => (
                <li key={u} className="flex items-center justify-between text-sm bg-gray-50 border rounded px-3 py-1.5">
                  <span className="text-gray-700">Photo {i + 1} ✓</span>
                  <button type="button" onClick={() => removePhoto(u)} className="text-red-600 text-xs hover:underline">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t pt-4 space-y-2">
          <Label>District Head Endorsement</Label>
          <p className="text-xs text-gray-500">
            The District Head of the locality must endorse this office. Upload the signed reference copy here (you can also have CJTF staff attach it later during review).
          </p>
          <div className="space-y-1">
            <Label className="text-xs font-normal text-gray-500">District Head Name (optional)</Label>
            <Input value={form.district_head_name} onChange={(e) => update({ district_head_name: e.target.value })} placeholder="Name of the endorsing District Head" />
          </div>
          <input type="file" accept="image/*,.pdf" onChange={handleEndorsement} disabled={uploadingDoc}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-cjtf-blue file:text-white file:text-xs file:cursor-pointer" />
          {uploadingDoc && <span className="text-xs text-gray-500">Uploading…</span>}
          {form.endorsement_doc_url && !uploadingDoc && <span className="text-xs text-cjtf-green font-medium block">✓ Signed endorsement uploaded</span>}
        </div>

        {!photosDone && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {photosRelaxed
              ? 'No office photo uploaded. You can continue for now, but INT screening may ask for one.'
              : 'Upload at least one photo of the office space to continue.'}
          </p>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={onNext} disabled={(!photosDone && !photosRelaxed) || uploadingPhoto || uploadingDoc || saving} className="bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Saving…' : 'Next Step →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Step 3: review + submit ──
function StepReview({ form, saving, onBack, onSubmit }: {
  form: FormState; saving: boolean; onBack: () => void; onSubmit: () => void
}) {
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value || '—'}</span>
    </div>
  )
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Review your registration</h2>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Registrant</p>
          {row('Name', [form.title, form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' '))}
          {row('Identity', form.identity_verified ? `Verified (${form.identity_verify_method?.toUpperCase()})` : form.identity_verify_waived ? 'Skipped (unverified)' : 'Not verified')}
          {row('Phone', form.phone_number)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Office</p>
          {row('Office name', form.office_name)}
          {row('Type', form.office_designation)}
          {row('Area council', form.area_council)}
          {row('District', form.district)}
          {row('Address', form.office_address)}
          {row('Photos uploaded', String(form.office_photo_urls.length))}
          {row('District head', form.district_head_name)}
          {row('Endorsement', form.endorsement_doc_url ? 'Uploaded' : 'Not yet uploaded')}
        </div>
        <p className="text-xs text-gray-500">
          After submitting you&apos;ll pay the registration fee. Your request is then screened by Intelligence and approved by the Admin/Command office, after which your Operational Permit is issued.
        </p>
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-cjtf-green hover:bg-cjtf-green-dark">
            {saving ? 'Submitting…' : 'Submit Registration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
