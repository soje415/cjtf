'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { captureElementAsA4Pdf } from '@/lib/capture-pdf'
import OperationalPermit, { PermitProps } from './OperationalPermit'

export default function PermitDownload({
  registrationId,
  permit,
  initialPdfUrl,
}: {
  registrationId: string
  permit: PermitProps
  initialPdfUrl: string | null
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialPdfUrl)
  const [saving, setSaving] = useState(false)
  const generatedOnce = useRef(false)

  // If the permit PDF hasn't been generated yet, render it once and upload.
  useEffect(() => {
    if (pdfUrl || generatedOnce.current) return
    generatedOnce.current = true
    const t = setTimeout(async () => {
      if (!cardRef.current) return
      setSaving(true)
      try {
        const blob = await captureElementAsA4Pdf(cardRef.current)
        const res = await fetch(`/api/office/${registrationId}/save-cert`, {
          method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: blob,
        })
        const data = await res.json()
        if (res.ok) { setPdfUrl(data.pdfUrl); toast.success('Operational Permit ready!') }
        else toast.error('Permit saved locally but upload failed: ' + (data.error ?? ''))
      } catch (e) {
        toast.error('Could not generate the permit PDF: ' + String(e))
      }
      setSaving(false)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Your CJTF Operational Permit</h1>
        <p className="text-gray-500 text-sm mt-1">
          Your office registration has been approved. Download or print your official Operational Permit.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block shadow-xl" style={{ transformOrigin: 'top left' }}>
          {/* Rendered at full A4 px size; scaled down for screen preview */}
          <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: 1123 * 0.62, height: 794 * 0.62 }}>
            <OperationalPermit ref={cardRef} {...permit} />
          </div>
        </div>
      </div>

      <Card className="border-cjtf-green">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Permit Number</p>
            <p className="font-mono text-cjtf-green text-xl font-bold tracking-wider mt-0.5">{permit.permitNumber}</p>
            <p className="text-xs text-gray-400 mt-0.5">{permit.officeName}</p>
          </div>
          <div className="flex gap-3">
            {pdfUrl ? (
              <>
                <a href={pdfUrl} download={`CJTF-Operational-Permit-${permit.permitNumber}.pdf`} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-cjtf-green hover:bg-cjtf-green-dark text-white">Download PDF</Button>
                </a>
                <Button variant="outline" onClick={() => window.open(pdfUrl!, '_blank')}
                  className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green hover:text-white">
                  Open &amp; Print
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500">{saving ? 'Generating permit…' : 'Preparing permit…'}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
