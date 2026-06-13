'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Application } from '@/lib/types'
import Step1Personal from './Step1Personal'
import Step2Contact from './Step2Contact'
import Step3NextOfKin from './Step3NextOfKin'
import Step4Documents from './Step4Documents'
import Step5Review from './Step5Review'

const STEP_TITLES = [
  'Personal Details',
  'Contact & Address',
  'Next of Kin',
  'Documents & Photo',
  'Review & Submit',
]

export type FormData = {
  first_name: string
  last_name: string
  middle_name: string
  date_of_birth: string
  gender: string
  state_of_origin: string
  lga_of_origin: string
  residential_address: string
  phone_number: string
  email: string
  next_of_kin_name: string
  next_of_kin_phone: string
  next_of_kin_relationship: string
  nin: string
  passport_photo_url: string
  id_document_url: string
  birth_cert_url: string
}

const EMPTY_FORM: FormData = {
  first_name: '', last_name: '', middle_name: '', date_of_birth: '',
  gender: '', state_of_origin: '', lga_of_origin: '', residential_address: '',
  phone_number: '', email: '', next_of_kin_name: '', next_of_kin_phone: '',
  next_of_kin_relationship: '', nin: '', passport_photo_url: '', id_document_url: '', birth_cert_url: '',
}

export default function ApplicationForm({
  existingApplication,
  userId,
}: {
  existingApplication: Application | null
  userId: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [appId, setAppId] = useState<string | null>(existingApplication?.id ?? null)
  const [form, setForm] = useState<FormData>({
    ...EMPTY_FORM,
    ...(existingApplication ? {
      first_name: existingApplication.first_name,
      last_name: existingApplication.last_name,
      middle_name: existingApplication.middle_name ?? '',
      date_of_birth: existingApplication.date_of_birth ?? '',
      gender: existingApplication.gender ?? '',
      state_of_origin: existingApplication.state_of_origin,
      lga_of_origin: existingApplication.lga_of_origin,
      residential_address: existingApplication.residential_address,
      phone_number: existingApplication.phone_number,
      email: existingApplication.email,
      next_of_kin_name: existingApplication.next_of_kin_name,
      next_of_kin_phone: existingApplication.next_of_kin_phone,
      next_of_kin_relationship: existingApplication.next_of_kin_relationship,
      nin: existingApplication.nin ?? '',
      passport_photo_url: existingApplication.passport_photo_url ?? '',
      id_document_url: existingApplication.id_document_url ?? '',
      birth_cert_url: existingApplication.birth_cert_url ?? '',
    } : {}),
  })

  function update(fields: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...fields }))
  }

  async function saveProgress(fields: Partial<FormData>) {
    setSaving(true)
    const merged = { ...form, ...fields }
    setForm(merged)

    try {
      let id = appId
      if (!id) {
        // Create the DRAFT application row first
        const res = await fetch('/api/applications', { method: 'POST' })
        const json = await res.json()
        id = json.application?.id ?? null
        if (id) setAppId(id)
      }

      if (id) {
        await fetch(`/api/applications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        })
      }
    } catch {
      toast.error('Failed to save progress. Check your connection.')
    }

    setSaving(false)
  }

  async function handleSubmit() {
    if (!appId) return
    setSaving(true)

    try {
      // Save final form state before submitting
      await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      // Transition: DRAFT → PENDING_PAYMENT
      const res = await fetch(`/api/applications/${appId}`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Failed to submit application')
        setSaving(false)
        return
      }

      toast.success('Application submitted! Your application is now under review.')
      router.push('/portal/applicant/dashboard')
    } catch {
      toast.error('Network error. Please try again.')
      setSaving(false)
    }
  }

  const stepProps = { form, update, saveProgress, saving }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">CJTF Application Form</h1>
        <p className="text-gray-500 text-sm mt-1">Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}</p>
        <div className="mt-3 flex gap-1">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-cjtf-green' : 'bg-gray-200'}`}
            />
          ))}
        </div>
      </div>

      {step === 0 && <Step1Personal {...stepProps} onNext={() => setStep(1)} />}
      {step === 1 && <Step2Contact {...stepProps} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
      {step === 2 && <Step3NextOfKin {...stepProps} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <Step4Documents {...stepProps} userId={userId} appId={appId} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <Step5Review {...stepProps} appId={appId} onBack={() => setStep(3)} onSubmit={handleSubmit} />}
    </div>
  )
}
