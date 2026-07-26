'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { OfficeRegistration, ApplicationNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export default function OfficeReview({
  registration,
  notes,
  role,
}: {
  registration: OfficeRegistration
  notes: (ApplicationNote & { registration_id?: string })[]
  role: 'int' | 'admin'
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [endorsementUrl, setEndorsementUrl] = useState(registration.endorsement_doc_url ?? '')
  const [uploading, setUploading] = useState(false)

  const reg = registration
  const fullName = [reg.title, reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(' ')
  const endpoint = role === 'int' ? 'int-review' : 'approve'
  const passLabel = role === 'int' ? 'Pass to Admin Approval' : 'Approve & Forward to ICT'
  const passDecision = role === 'int' ? 'pass' : 'approve'

  async function decide(decision: string) {
    if (decision !== passDecision && !note.trim()) {
      toast.error('A reason is required to reject.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/office/${reg.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Action failed'); setBusy(false); return }
      toast.success(decision === passDecision ? 'Done.' : 'Registration rejected.')
      router.push(`/portal/${role}/dashboard`)
    } catch {
      toast.error('Network error.')
      setBusy(false)
    }
  }

  async function uploadEndorsement(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await fetch(`/api/office/${reg.id}/upload-endorsement`, {
        method: 'POST', headers: { 'Content-Type': file.type }, body: file,
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Upload failed'); setUploading(false); return }
      setEndorsementUrl(json.url)
      toast.success('Endorsement uploaded')
    } catch { toast.error('Upload failed.') }
    setUploading(false)
    e.target.value = ''
  }

  const field = (label: string, value: string | null | undefined) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value || '—'}</span>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Office Registration Review</h1>
        <p className="text-gray-500 text-sm">{role === 'int' ? 'Intelligence screening' : 'Admin / Command approval (final sign-off)'}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Registrant</CardTitle></CardHeader>
        <CardContent>
          {field('Name', fullName)}
          {field('Identity', reg.identity_verified ? `Verified (${reg.identity_verify_method?.toUpperCase()})` : reg.identity_verify_waived ? 'Waived' : 'Not verified')}
          {field('Phone', reg.phone_number)}
          {field('Email', reg.email)}
          {field('Residential address', reg.residential_address)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Office</CardTitle></CardHeader>
        <CardContent>
          {field('Office name', reg.office_name)}
          {field('Type', reg.office_designation)}
          {field('Area council', reg.area_council)}
          {field('District', reg.district)}
          {field('Office address', reg.office_address)}
          {field('Landmark', reg.landmark)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Office-Space Photos</CardTitle></CardHeader>
        <CardContent>
          {reg.office_photo_urls && reg.office_photo_urls.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {reg.office_photo_urls.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                  <Image src={url} alt={`Office photo ${i + 1}`} width={200} height={150} unoptimized
                    className="rounded-md object-cover border w-full h-28" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No photos uploaded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">District-Head Endorsement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {field('District head', reg.district_head_name)}
          {endorsementUrl ? (
            <a href={endorsementUrl} target="_blank" rel="noopener noreferrer" className="text-cjtf-blue underline text-sm">
              View signed endorsement document →
            </a>
          ) : (
            <p className="text-sm text-amber-700">No signed endorsement uploaded yet.</p>
          )}
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500 mb-1">Attach / replace the signed District-Head endorsement:</p>
            <input type="file" accept="image/*,.pdf" onChange={uploadEndorsement} disabled={uploading}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-cjtf-blue file:text-white file:text-xs file:cursor-pointer" />
            {uploading && <span className="text-xs text-gray-500 ml-2">Uploading…</span>}
          </div>
        </CardContent>
      </Card>

      {notes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="text-sm border-b border-gray-100 pb-2 last:border-0">
                <p className="text-gray-800">{n.note}</p>
                <p className="text-xs text-gray-400">
                  {n.profiles?.full_name ?? 'Staff'} ({n.action}) · {new Date(n.created_at).toLocaleString('en-NG')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Decision</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (required to reject, optional to approve)" />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => decide(passDecision)} disabled={busy} className="bg-cjtf-green hover:bg-cjtf-green-dark">
              {busy ? 'Working…' : passLabel}
            </Button>
            <Button onClick={() => decide('reject')} disabled={busy} variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
