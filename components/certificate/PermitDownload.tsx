'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import OperationalPermit, { PermitProps } from './OperationalPermit'

export default function PermitDownload({
  registrationId,
  permit,
  initialPdfUrl,
}: {
  registrationId: string
  permit: Omit<PermitProps, 'qrDataUrl'>
  initialPdfUrl: string | null
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  // ICT generates and saves the permit PDF (see PermitGenerate + save-cert).
  // The registrant only ever downloads what's already been issued.
  const pdfUrl = initialPdfUrl

  useEffect(() => {
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/office/${registrationId}`
    import('qrcode').then(QRCode => QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 }))
      .then(setQrDataUrl)
      .catch(() => {})
  }, [registrationId])

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
            <OperationalPermit ref={cardRef} {...permit} qrDataUrl={qrDataUrl} />
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
              <p className="text-sm text-gray-500">Your permit is being finalized by ICT — check back shortly.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
