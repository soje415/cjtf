'use client'

import { useState } from 'react'
import { FormData } from './ApplicationForm'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

interface Props {
  form: FormData
  update: (f: Partial<FormData>) => void
  saveProgress: (f: Partial<FormData>) => Promise<void>
  saving: boolean
  userId: string
  appId: string | null
  onNext: () => void
  onBack: () => void
}

type DocField = 'passport_photo_url' | 'id_document_url' | 'birth_cert_url'

const DOCS: { field: DocField; label: string; accept: string }[] = [
  { field: 'passport_photo_url', label: 'Passport Photograph *', accept: 'image/*' },
  { field: 'id_document_url', label: 'National ID / Voter Card / NIN Slip', accept: 'image/*,.pdf' },
  { field: 'birth_cert_url', label: 'Birth Certificate / Declaration of Age', accept: 'image/*,.pdf' },
]

export default function Step4Documents({ form, update, saveProgress, saving, appId, onNext, onBack }: Props) {
  const [uploading, setUploading] = useState<DocField | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, field: DocField) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!appId) {
      toast.error('Please complete the previous steps first.')
      return
    }

    setUploading(field)

    try {
      // Get a signed upload URL from the server (uses service role, bypasses RLS)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, applicationId: appId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to get upload URL')
        setUploading(null)
        return
      }

      // Upload directly to Supabase Storage using the signed URL
      const uploadRes = await fetch(json.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        toast.error('Upload failed. Please try again.')
        setUploading(null)
        return
      }

      update({ [field]: json.publicUrl })
      toast.success('File uploaded')
    } catch {
      toast.error('Upload failed. Check your connection.')
    }

    setUploading(null)
  }

  async function handleNext() {
    await saveProgress({})
    onNext()
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <p className="text-sm text-gray-500">Upload clear photos or scanned copies of your documents. Passport photo is required.</p>
        {DOCS.map(({ field, label, accept }) => (
          <div key={field} className="space-y-1">
            <Label>{label}</Label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept={accept}
                onChange={(e) => handleUpload(e, field)}
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-cjtf-green file:text-white file:text-xs file:cursor-pointer hover:file:bg-cjtf-green-dark"
                disabled={!!uploading}
              />
              {uploading === field && <span className="text-xs text-gray-500">Uploading…</span>}
              {form[field] && uploading !== field && (
                <span className="text-xs text-cjtf-green font-medium">✓ Uploaded</span>
              )}
            </div>
          </div>
        ))}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button
            onClick={handleNext}
            disabled={!form.passport_photo_url || !!uploading || saving}
            className="bg-cjtf-green hover:bg-cjtf-green-dark"
          >
            {saving ? 'Saving…' : 'Next Step →'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
