'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { captureElementAsA4Pdf } from '@/lib/capture-pdf'
import OperationalPermit from './OperationalPermit'

interface Props {
  registrationId: string
  fullName: string
  officeAddress: string
  officeName: string
  dateIssued: string
  initialCertNumber: string | null
  initialPdfUrl: string | null
}

// ICT-side: assign the permit number, render the Operational Permit, capture it
// to an A4 PDF, save it (status → COMPLETED), then print the hard copy.
export default function PermitGenerate({
  registrationId, fullName, officeAddress, officeName, dateIssued, initialCertNumber, initialPdfUrl,
}: Props) {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const [certNumber, setCertNumber] = useState<string | null>(initialCertNumber)
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialPdfUrl)
  const [busy, setBusy] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    try {
      // 1. Assign / fetch the permit number
      const res = await fetch(`/api/office/${registrationId}/ict-generate`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Could not assign permit number'); setBusy(false); return }
      setCertNumber(d.certNumber)
      toast.success(`Permit number assigned: ${d.certNumber}`)

      // 1b. Generate the QR up front so html2canvas never races its image load
      try {
        const QRCode = await import('qrcode')
        const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/office/${registrationId}`
        setQrDataUrl(await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 }))
      } catch { /* permit renders without a QR image if this fails */ }

      // 2. Let the permit render with the number, then capture + save
      setTimeout(async () => {
        if (!cardRef.current) { setBusy(false); return }
        try {
          const blob = await captureElementAsA4Pdf(cardRef.current)
          const up = await fetch(`/api/office/${registrationId}/save-cert`, {
            method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: blob,
          })
          const ud = await up.json()
          if (up.ok) { setPdfUrl(ud.pdfUrl); toast.success('Permit generated and saved.') }
          else toast.error('Save failed: ' + (ud.error ?? ''))
        } catch (e) {
          toast.error('Permit capture failed: ' + String(e))
        }
        setBusy(false)
        router.refresh()
      }, 400)
    } catch {
      toast.error('Network error.')
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Issue Operational Permit</h1>
        <p className="text-gray-500 text-sm mt-1">
          ICT section — generate, save and print the permit, then hand the hard copy to Admin/Command.
        </p>
      </div>

      <Card className="border-cjtf-green">
        <CardHeader className="pb-2"><CardTitle className="text-base">Permit</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-500 uppercase">Office</p><p className="font-medium text-gray-800">{officeName}</p></div>
            <div><p className="text-xs text-gray-500 uppercase">Location</p><p className="font-medium text-gray-800">{officeAddress}</p></div>
            <div><p className="text-xs text-gray-500 uppercase">Registrant</p><p className="font-medium text-gray-800">{fullName}</p></div>
            <div><p className="text-xs text-gray-500 uppercase">Permit No.</p><p className="font-mono text-cjtf-green font-bold">{certNumber ?? 'Not yet assigned'}</p></div>
          </div>
          <div className="flex flex-wrap gap-3">
            {!pdfUrl && (
              <Button onClick={generate} disabled={busy} className="bg-cjtf-green hover:bg-cjtf-green-dark text-white">
                {busy ? 'Generating…' : 'Generate & Save Permit'}
              </Button>
            )}
            {pdfUrl && (
              <>
                <a href={pdfUrl} download={`CJTF-Operational-Permit-${certNumber}.pdf`} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-cjtf-green hover:bg-cjtf-green-dark text-white">Download PDF</Button>
                </a>
                <Button variant="outline" onClick={() => window.open(pdfUrl, '_blank')}
                  className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green hover:text-white">
                  Open &amp; Print
                </Button>
                <Button variant="outline" onClick={generate} disabled={busy}
                  className="border-gray-300 text-gray-600 hover:bg-gray-100">
                  {busy ? 'Regenerating…' : 'Regenerate PDF'}
                </Button>
              </>
            )}
          </div>
          {pdfUrl && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Permit issued. Print the hard copy and hand it over to Admin/Command. (Physical handover log to be added later.)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Live permit preview (display only — scaled down for a compact view) */}
      <div className="overflow-x-auto">
        <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: 1123 * 0.62, height: 794 * 0.62 }}>
          <OperationalPermit
            fullName={fullName}
            officeAddress={officeAddress}
            officeName={officeName}
            permitNumber={certNumber ?? '—'}
            dateIssued={dateIssued}
            qrDataUrl={qrDataUrl}
          />
        </div>
      </div>

      {/* Hidden, unscaled capture source. html2canvas manually re-implements
          text layout by walking the DOM — a scaled ancestor (the preview
          above) throws off its glyph positioning and produces scrambled
          text in the exported PDF, even though the scaled preview looks
          fine natively in the browser. Capturing from an untransformed
          clone avoids that entirely. */}
      <div style={{ position: 'fixed', top: 0, left: -99999, pointerEvents: 'none' }} aria-hidden>
        <OperationalPermit
          ref={cardRef}
          fullName={fullName}
          officeAddress={officeAddress}
          officeName={officeName}
          permitNumber={certNumber ?? '—'}
          dateIssued={dateIssued}
          qrDataUrl={qrDataUrl}
        />
      </div>
    </div>
  )
}
