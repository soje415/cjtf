'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Application, Payment, ApplicationNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { STATUS_LABELS, STATUS_COLORS, MEMBERSHIP_TYPE_LABELS, MEMBERSHIP_TYPE_COLORS } from '@/lib/types'
import { IdCardPreview, IdCardBackPreview } from '@/components/id-card/IdCardDownload'
import { rankForCard } from '@/lib/ranks'
import SignaturePad from '@/components/id-card/SignaturePad'
import { memberVerifyUrl } from '@/lib/portal-url'
import { captureFrontAndBackAsPdf, toDataUrl } from '@/lib/capture-pdf'
import { toast } from 'sonner'

interface Props {
  application: Application
  payments: Payment[]
  notes: (ApplicationNote & { profiles?: { full_name: string; role: string } })[]
}

interface GeneratedResult {
  cjtfId: string
  pdfUrl: string | null
}

export default function IctApplicationReview({ application, payments, notes }: Props) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState<GeneratedResult | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')
  const [waiving, setWaiving] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  // Captured at the desk, immediately before the card is generated. Held as
  // data URLs so the capture can draw them without waiting on a round trip.
  const [holderSig, setHolderSig] = useState<string | null>(application.holder_signature_url)
  const [officerSig, setOfficerSig] = useState<string | null>(application.officer_signature_url)
  const cardRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  const isVerification = application.status === 'PENDING_ICT_VERIFICATION'
  const isGenerating = application.status === 'APPROVED_GENERATING_ID'

  async function handleWaive() {
    if (!waiveReason.trim()) { toast.error('Enter a reason to waive verification'); return }
    setWaiving(true)
    const res = await fetch(`/api/applications/${application.id}/waive-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: waiveReason }),
    })
    if (res.ok) {
      toast.success('Identity verification waived')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to waive')
    }
    setWaiving(false)
  }

  async function handleForward() {
    setLoading(true)
    const res = await fetch(`/api/applications/${application.id}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    if (res.ok) {
      toast.success('Application forwarded to Intelligence department')
      router.push('/portal/ict/dashboard')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to forward')
    }
    setLoading(false)
  }

  async function handleGenerateId() {
    setLoading(true)
    try {
      // 0. Persist the signatures first — the card is about to be rasterised
      // with them on it, and a card whose PDF shows a signature the record
      // doesn't have is worse than one with no signature at all.
      if (holderSig?.startsWith('data:') || officerSig?.startsWith('data:')) {
        const sigRes = await fetch(`/api/applications/${application.id}/save-signatures`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            holderSignature: holderSig?.startsWith('data:') ? holderSig : undefined,
            officerSignature: officerSig?.startsWith('data:') ? officerSig : undefined,
          }),
        })
        if (!sigRes.ok) {
          const sd = await sigRes.json().catch(() => ({}))
          toast.error(sd.error || 'Could not save the signatures')
          setLoading(false)
          return
        }
      }

      // 1. Assign CJTF ID and complete the application on the server
      const res = await fetch(`/api/applications/${application.id}/generate-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Failed to generate ID'); setLoading(false); return }

      // 2. Pre-fetch the passport photo as a data URL so html2canvas can read it
      let photoUrl = application.passport_photo_url ?? ''
      if (photoUrl) {
        try { photoUrl = await toDataUrl(photoUrl) } catch { /* use original url */ }
      }
      setPhotoDataUrl(photoUrl)

      // 3. Generate the QR code up front so html2canvas never races its image load
      const verifyUrl = memberVerifyUrl(application.id)
      try {
        const QRCode = await import('qrcode')
        setQrDataUrl(await QRCode.toDataURL(verifyUrl, { width: 96, margin: 1 }))
      } catch { /* card renders without a QR image if this fails */ }

      setGenerated({ cjtfId: d.cjtfId, pdfUrl: null })
      toast.success('ID assigned — capturing card…')

      // 4. Give React one tick to render front + back, then capture both
      setTimeout(async () => {
        if (!cardRef.current || !backRef.current) return
        setCapturing(true)
        try {
          const blob = await captureFrontAndBackAsPdf(cardRef.current, backRef.current)

          // 5. Upload to Supabase via server route
          const uploadRes = await fetch(`/api/applications/${application.id}/save-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf' },
            body: blob,
          })
          const uploadData = await uploadRes.json()
          if (uploadRes.ok) {
            setGenerated({ cjtfId: d.cjtfId, pdfUrl: uploadData.pdfUrl })
            toast.success('ID Card ready!')
          } else {
            toast.error('Card saved but PDF upload failed: ' + uploadData.error)
            setGenerated({ cjtfId: d.cjtfId, pdfUrl: null })
          }
        } catch (e) {
          toast.error('PDF capture failed: ' + String(e))
          setGenerated({ cjtfId: d.cjtfId, pdfUrl: null })
        }
        setCapturing(false)
      }, 300)
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (generated?.pdfUrl) {
      const a = document.createElement('a')
      a.href = generated.pdfUrl
      a.download = `CJTF-ID-${generated.cjtfId}.pdf`
      a.click()
      return
    }
    // Fallback: re-capture if no pdfUrl
    if (!cardRef.current || !backRef.current) return
    setCapturing(true)
    try {
      const blob = await captureFrontAndBackAsPdf(cardRef.current, backRef.current)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CJTF-ID-${generated?.cjtfId ?? 'card'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Download failed') }
    setCapturing(false)
  }

  // ── Generated state ──
  if (generated) {
    const fullName = [application.first_name, application.middle_name, application.last_name]
      .filter(Boolean).join(' ')
    const verifyUrl = memberVerifyUrl(application.id)
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Success banner */}
        <div className="rounded-lg bg-cjtf-green px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg">ID Card Generated</p>
            <p className="text-green-200 text-sm mt-0.5">{fullName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-300 uppercase tracking-wide">CJTF ID Number</p>
            <p className="font-mono text-white font-bold text-xl tracking-wider">{generated.cjtfId}</p>
          </div>
        </div>

        {/* Card preview — these exact elements are captured for the PDF */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Generated ID Card — Front {capturing && <span className="text-yellow-500">— capturing PDF…</span>}
          </p>
          <div className="flex justify-center">
            <div ref={cardRef}>
              <IdCardPreview
                fullName={fullName}
                cjtfId={generated.cjtfId}
                residentialAddress={application.residential_address ?? ''}
                lga={application.lga_of_origin}
                gender={application.gender ?? ''}
                bloodGroup={application.blood_group ?? undefined}
                designation={rankForCard(application.cjtf_rank)}
                issueDate={issueDate}
                photoUrl={photoDataUrl ?? application.passport_photo_url ?? ''}
                verifyUrl={verifyUrl}
                qrDataUrl={qrDataUrl}
                sectorCommand={application.sector_command}
                subSector={application.sub_sector}
                unit={application.unit}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Generated ID Card — Back</p>
          <div className="flex justify-center">
            <div ref={backRef}>
              <IdCardBackPreview
                cjtfId={generated.cjtfId}
                designation={rankForCard(application.cjtf_rank)}
                issueDate={issueDate}
                holderSignatureUrl={holderSig}
                officerSignatureUrl={officerSig}
              />
            </div>
          </div>
        </div>

        {/* Action bar */}
        <Card className="border-cjtf-green">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              {generated.pdfUrl
                ? 'Card saved to applicant portal. Hand or send the PDF below.'
                : capturing ? 'Capturing PDF from card preview…' : 'PDF not yet saved.'}
            </p>
            <div className="flex gap-3 flex-shrink-0">
              <Button
                onClick={handleDownload}
                disabled={capturing}
                className="bg-cjtf-green hover:bg-cjtf-green-dark text-white"
              >
                {capturing ? 'Capturing…' : 'Download PDF'}
              </Button>
              {generated.pdfUrl && (
                <Button variant="outline"
                  className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green hover:text-white"
                  onClick={() => window.open(generated.pdfUrl!, '_blank')}>
                  Open &amp; Print
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => router.push('/portal/ict/dashboard')}>
            Done — Return to Dashboard →
          </Button>
        </div>
      </div>
    )
  }

  // ── Normal review state ──
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {application.first_name} {application.last_name}
          </h1>
          <p className="text-sm text-gray-500">Application Review — ICT</p>
        </div>
        <div className="flex gap-2">
          <Badge className={MEMBERSHIP_TYPE_COLORS[application.membership_type]}>
            {MEMBERSHIP_TYPE_LABELS[application.membership_type]}
          </Badge>
          <Badge className={STATUS_COLORS[application.status]}>{STATUS_LABELS[application.status]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {application.passport_photo_url && (
          <Card>
            <CardContent className="p-4 text-center">
              <Image src={application.passport_photo_url} alt="Passport"
                width={120} height={140} className="mx-auto rounded object-cover" />
              <p className="text-xs text-gray-500 mt-2">Passport Photo</p>
            </CardContent>
          </Card>
        )}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Personal Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Full Name', `${application.first_name} ${application.middle_name ?? ''} ${application.last_name}`],
              // What Command assigned — this is the string that prints on the card.
              ['Rank', application.cjtf_rank ?? 'Not yet assigned'],
              ['Date of Birth', application.date_of_birth ?? '—'],
              ['Gender', application.gender ?? '—'],
              ['NIN', application.nin || '—'],
              ['State', application.state_of_origin],
              ['LGA', application.lga_of_origin],
              ['Phone', application.phone_number],
              ['Email', application.email],
              ['Address', application.residential_address],
              ['Sector Command', application.sector_command || '—'],
              ['Sub Sector', application.sub_sector || '—'],
              ['Unit', application.unit || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {application.membership_type === 'legacy' && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Existing Membership Claim</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-gray-500 text-xs">Self-Reported Rank</p>
                <p className="font-medium">{application.self_reported_rank || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Old CJTF ID / Rank Card No.</p>
                <p className="font-medium">{application.legacy_id_number || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Vouching Officer</p>
                <p className="font-medium">{application.vouching_officer_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Vouching Note</p>
                {application.vouching_doc_url ? (
                  <a href={application.vouching_doc_url} target="_blank" rel="noreferrer" className="font-medium text-cjtf-green underline">
                    View document
                  </a>
                ) : (
                  <p className="font-medium">Not provided</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Identity Verification</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {application.identity_verified ? (
            <p className="text-green-700 font-medium">
              ✓ Verified via {application.identity_verify_method?.toUpperCase()}
              {application.identity_verified_at && (
                <span className="text-gray-400 font-normal ml-2">
                  {new Date(application.identity_verified_at).toLocaleString('en-GB')}
                </span>
              )}
            </p>
          ) : application.identity_verify_waived ? (
            <p className="text-amber-700 font-medium">
              ⚠ Verification waived by staff
              {application.identity_verify_waived_reason && (
                <span className="text-gray-500 font-normal ml-2">— {application.identity_verify_waived_reason}</span>
              )}
            </p>
          ) : (
            <>
              <p className="text-red-600 font-medium">✗ Identity not verified (no NIN/BVN match on file)</p>
              {isVerification && (
                <div className="flex gap-2 pt-1">
                  <Input
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                    placeholder="Reason to waive (e.g. no NIN/BVN, verified manually)"
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleWaive} disabled={waiving}>
                    {waiving ? 'Waiving…' : 'Waive'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Next of Kin</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-sm">
          {[
            ['Name', application.next_of_kin_name],
            ['Phone', application.next_of_kin_phone],
            ['Relationship', application.next_of_kin_relationship],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="font-medium">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Uploaded Documents</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {application.id_document_url && (
            <a href={application.id_document_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-cjtf-green underline">View ID Document</a>
          )}
          {application.birth_cert_url && (
            <a href={application.birth_cert_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-cjtf-green underline">View Birth Certificate</a>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Records</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="capitalize">{p.type.replace('_', ' ')} Fee</span>
                <span>₦{(p.amount / 100).toLocaleString()}</span>
                <Badge className={p.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                  {p.status}
                </Badge>
                <span className="font-mono text-xs text-gray-400">{p.paystack_reference}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {notes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Processing Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="text-sm border-l-2 border-cjtf-green pl-3">
                <p className="font-medium text-gray-700">{n.note}</p>
                <p className="text-xs text-gray-400">
                  {n.profiles?.full_name} ({n.profiles?.role}) — {new Date(n.created_at).toLocaleString('en-NG')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Signatures are collected here, at the desk, because this is the last
          moment before the card is rasterised — after generation the PDF is
          fixed and a missing signature means reissuing the card. */}
      {isGenerating && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Signatures for the Card Back</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SignaturePad
              label="Applicant's Signature"
              hint="Have the applicant sign in the box, or upload a scan."
              value={holderSig}
              onChange={setHolderSig}
            />
            <SignaturePad
              label="Issuing Officer's Signature"
              hint="Sign here, or upload your stored signature image."
              value={officerSig}
              onChange={setOfficerSig}
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Add Note (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isGenerating ? 'Notes before generating ID card…' : 'Notes for the Intelligence department…'}
            rows={3}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
          {isVerification && (
            <Button onClick={handleForward} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? 'Forwarding…' : 'Forward to Intelligence →'}
            </Button>
          )}
          {isGenerating && (
            <Button onClick={handleGenerateId} disabled={loading}
              className="bg-cjtf-green hover:bg-cjtf-green-dark">
              {loading ? 'Generating ID…' : 'Generate ID Card'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
