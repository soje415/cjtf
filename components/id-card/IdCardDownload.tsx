'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface IdCardPreviewProps {
  fullName: string
  cjtfId: string
  stateOfOrigin: string
  lga: string
  dateOfBirth: string
  gender: string
  nin?: string
  bloodGroup?: string
  designation?: string
  issueDate: string
  photoUrl: string
  verifyUrl?: string
  /** Pre-generated QR data URL. When set, skips the internal async fetch
   * (used by capture flows so html2canvas never races the QR image). */
  qrDataUrl?: string | null
}

interface DownloadProps extends IdCardPreviewProps {
  pdfUrl: string
}

const C = {
  green:  '#008751',
  gold:   '#FFD700',
  white:  '#ffffff',
  black:  '#1a1a1a',
  grey:   '#5a5a5a',
  red:    '#CC0000',
  yellow: '#FFD700',
}

function SmallField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 5.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.3, margin: 0, lineHeight: 1 }}>{label}</p>
      <p style={{ fontSize: 7.5, color: C.black, fontWeight: 600, margin: '1px 0 0 0', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

export function IdCardPreview({
  fullName, cjtfId, stateOfOrigin, lga, dateOfBirth, gender, nin, bloodGroup,
  designation = 'VOLUNTEER MEMBER', issueDate, photoUrl, verifyUrl, qrDataUrl: qrDataUrlProp,
}: IdCardPreviewProps) {
  const [qrDataUrlState, setQrDataUrlState] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (qrDataUrlProp !== undefined || !verifyUrl) return
    import('qrcode').then(QRCode => QRCode.toDataURL(verifyUrl, { width: 96, margin: 1 }))
      .then(url => { if (mounted.current) setQrDataUrlState(url) })
      .catch(() => {})
    return () => { mounted.current = false }
  }, [verifyUrl, qrDataUrlProp])

  const qrDataUrl = qrDataUrlProp !== undefined ? qrDataUrlProp : qrDataUrlState

  const expiryYear = new Date().getFullYear() + 4
  const expiryDate = `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}/${expiryYear}`

  // 342 × 216 px  (≈ 2× CR80)
  const STRIPE = 15   // left stripe total width
  const CARD_W = 342
  const CARD_H = 216
  const MAIN_W = CARD_W - STRIPE

  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      display: 'flex', flexDirection: 'row',
      fontFamily: 'Inter, Arial, sans-serif',
      overflow: 'hidden', borderRadius: 8, position: 'relative',
      boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
    }}>

      {/* ── LEFT COLOUR STRIPE ── */}
      <div style={{ width: STRIPE, height: CARD_H, display: 'flex', flexDirection: 'row', flexShrink: 0 }}>
        <div style={{ flex: 1, background: C.green }} />
        <div style={{ flex: 1, background: C.yellow }} />
        <div style={{ flex: 1, background: C.red }} />
      </div>

      {/* ── MAIN CARD CONTENT ── */}
      <div style={{ width: MAIN_W, height: CARD_H, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* White base so the watermark has something to sit on */}
        <div style={{ position: 'absolute', inset: 0, background: C.white, zIndex: 0 }} />

        {/* Watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cjtf-logo.jpg" alt="" crossOrigin="anonymous"
            style={{ width: 150, height: 150, objectFit: 'contain', opacity: 0.06, filter: 'grayscale(1)' }} />
        </div>

        {/* Foil / hologram accent */}
        <div style={{
          position: 'absolute', right: -10, bottom: 16, width: 46, height: 46, borderRadius: '50%',
          background: 'conic-gradient(from 90deg, #c9a227, #fff6d9, #008751, #fff, #CC0000, #c9a227)',
          opacity: 0.35, filter: 'blur(0.3px)', pointerEvents: 'none', zIndex: 0,
        }} />

        {/* HEADER – black band */}
        <div style={{
          height: 46, background: C.black,
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          padding: '0 8px', gap: 6, position: 'relative', zIndex: 1,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 15, background: '#3a3a3a', overflow: 'hidden',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${C.gold}`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cjtf-logo.jpg" alt="CJTF" crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 8.5, fontWeight: 700, color: C.white, letterSpacing: 0.5, margin: 0 }}>
              CIVILIAN JOINT TASK FORCE
            </p>
            <p style={{ fontSize: 5.5, color: C.gold, margin: '2px 0 0 0' }}>
              Official Identification Card — Federal Republic of Nigeria
            </p>
          </div>
          <div style={{
            fontSize: 5, fontWeight: 700, color: C.green,
            background: C.white, padding: '2px 4px', borderRadius: 2,
          }}>CJTF</div>
        </div>

        {/* BODY */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'row',
          padding: '5px 8px 4px 6px', gap: 7,
          position: 'relative', zIndex: 1,
        }}>

          {/* Photo column */}
          <div style={{ width: 68, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
            <div style={{ width: 64, height: 78, border: `2px solid ${C.green}`, borderRadius: 2, overflow: 'hidden', background: '#e0e0e0' }}>
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Passport" crossOrigin="anonymous"
                  style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#9ca3af' }}>Photo</div>
              )}
            </div>
          </div>

          {/* Details column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.2 }}>{fullName}</p>
            <p style={{ fontSize: 8, fontWeight: 700, color: C.green, letterSpacing: 0.3, margin: '1px 0 3px 0' }}>{cjtfId}</p>

            {/* Rank / Designation */}
            <p style={{ fontSize: 4.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Rank</p>
            <p style={{ fontSize: 8, fontWeight: 700, color: C.green, margin: '1px 0 4px 0', lineHeight: 1 }}>{designation}</p>

            {/* Small fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
              <SmallField label="Date of Birth" value={dateOfBirth || '—'} />
              <SmallField label="Gender" value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '—'} />
              <SmallField label="State of Origin" value={stateOfOrigin} />
              <SmallField label="LGA" value={lga} />
              {nin && <SmallField label="NIN" value={nin} />}
              {bloodGroup && <SmallField label="Blood Group" value={bloodGroup} />}
              <SmallField label="Issue Date" value={issueDate} />
              <SmallField label="Expiry Date" value={expiryDate} />
            </div>
          </div>

          {/* QR column */}
          <div style={{ width: 50, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR" style={{ width: 46, height: 46 }} />
            ) : (
              <div style={{ width: 46, height: 46, background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: verifyUrl ? 5 : 7, color: '#9ca3af' }}>
                {verifyUrl ? 'Loading…' : 'QR'}
              </div>
            )}
            <p style={{ fontSize: 5, color: C.grey, textAlign: 'center', margin: 0 }}>Scan to{'\n'}Verify</p>
          </div>
        </div>

        {/* GREEN FOOTER */}
        <div style={{
          height: 18, background: C.green, position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px',
        }}>
          <p style={{ fontSize: 4.5, color: C.white, margin: 0 }}>Property of CJTF FCT Command. If found, return to nearest CJTF office.</p>
          <p style={{ fontSize: 4.5, color: C.gold, margin: 0, fontWeight: 700 }}>ISSUING AUTHORITY: FCT COMMAND</p>
        </div>

        {/* BLACK BOTTOM STRIPE */}
        <div style={{ height: 5, background: C.black, position: 'relative', zIndex: 1 }} />
      </div>
    </div>
  )
}

export interface IdCardBackPreviewProps {
  cjtfId: string
}

const TERMS = [
  'This card is non-transferable and remains the property of CJTF Nigeria.',
  'Must be surrendered on demand to an authorized CJTF or law enforcement officer.',
  'Loss or theft must be reported immediately to the nearest CJTF office.',
]

export function IdCardBackPreview({ cjtfId }: IdCardBackPreviewProps) {
  // Same footprint as the front so the two pages line up when printed.
  const STRIPE = 15
  const CARD_W = 342
  const CARD_H = 216
  const MAIN_W = CARD_W - STRIPE

  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      display: 'flex', flexDirection: 'row',
      fontFamily: 'Inter, Arial, sans-serif',
      overflow: 'hidden', borderRadius: 8, position: 'relative',
      boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
    }}>
      {/* ── LEFT COLOUR STRIPE ── */}
      <div style={{ width: STRIPE, height: CARD_H, display: 'flex', flexDirection: 'row', flexShrink: 0 }}>
        <div style={{ flex: 1, background: C.green }} />
        <div style={{ flex: 1, background: C.yellow }} />
        <div style={{ flex: 1, background: C.red }} />
      </div>

      {/* ── MAIN CARD CONTENT ── */}
      <div style={{ width: MAIN_W, height: CARD_H, display: 'flex', flexDirection: 'column', position: 'relative', background: C.white }}>

        {/* Watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cjtf-logo.jpg" alt="" crossOrigin="anonymous"
            style={{ width: 150, height: 150, objectFit: 'contain', opacity: 0.06, filter: 'grayscale(1)' }} />
        </div>

        {/* HEADER – black band */}
        <div style={{
          height: 22, background: C.black,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 1,
        }}>
          <p style={{ fontSize: 6.5, fontWeight: 700, color: C.gold, letterSpacing: 1, margin: 0 }}>
            TERMS &amp; CONDITIONS OF USE
          </p>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, padding: '8px 10px 4px 10px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Terms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {TERMS.map((t) => (
              <p key={t} style={{ fontSize: 5.5, color: C.black, margin: 0, lineHeight: 1.35 }}>&bull;&nbsp; {t}</p>
            ))}
          </div>

          {/* Signature strip */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingBottom: 4 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ borderBottom: `1px solid ${C.grey}`, height: 22 }} />
              <p style={{ fontSize: 5, color: C.grey, margin: '2px 0 0 0' }}>Holder&apos;s Signature</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ borderBottom: `1px solid ${C.grey}`, height: 22 }} />
              <p style={{ fontSize: 5, color: C.grey, margin: '2px 0 0 0' }}>Issuing Officer &amp; Stamp</p>
            </div>
          </div>
        </div>

        {/* GREEN FOOTER */}
        <div style={{
          height: 18, background: C.green, position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px',
        }}>
          <p style={{ fontSize: 4.5, color: C.white, margin: 0 }}>CJTF ID: {cjtfId}</p>
          <p style={{ fontSize: 4.5, color: C.gold, margin: 0, fontWeight: 700 }}>www.cjtf.gov.ng</p>
        </div>

        {/* BLACK BOTTOM STRIPE */}
        <div style={{ height: 5, background: C.black, position: 'relative', zIndex: 1 }} />
      </div>
    </div>
  )
}

export default function IdCardDownload(props: DownloadProps) {
  const { fullName, cjtfId, pdfUrl } = props

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #id-card-print-root {
            display: flex !important; flex-direction: column;
            justify-content: center; align-items: center; height: 100vh; gap: 0;
          }
          #id-card-print-front { page-break-after: always; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Your CJTF ID Card</h1>
          <p className="text-gray-500 text-sm mt-1">Your application has been approved. Download or print your official ID card.</p>
        </div>

        <div id="id-card-print-root">
          <div id="id-card-print-front">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Card Preview — Front</p>
            <div className="flex justify-center">
              <IdCardPreview {...props} />
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Card Preview — Back</p>
            <div className="flex justify-center">
              <IdCardBackPreview cjtfId={cjtfId} />
            </div>
          </div>
        </div>

        <Card className="border-cjtf-green">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">CJTF ID Number</p>
                <p className="font-mono text-cjtf-green text-xl font-bold tracking-wider mt-0.5">{cjtfId}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fullName}</p>
              </div>
              <div className="flex gap-3">
                {pdfUrl ? (
                  <>
                    <a href={pdfUrl} download={`CJTF-ID-${cjtfId}.pdf`} target="_blank" rel="noopener noreferrer">
                      <Button className="bg-cjtf-green hover:bg-cjtf-green-dark text-white">Download PDF</Button>
                    </a>
                    <Button variant="outline" onClick={() => window.open(pdfUrl, '_blank')}
                      className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green hover:text-white">
                      Open &amp; Print
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">PDF not yet available</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-700">Plastic Card Printing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-gray-600">Take the downloaded PDF to any ID card printing centre and specify:</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Card Size', 'CR80 — 85.6 mm × 54 mm'],
                ['Orientation', 'Landscape'],
                ['Print Quality', '300 DPI or higher'],
                ['Card Thickness', '0.76 mm (standard PVC)'],
                ['Lamination', 'Glossy or matte overlay'],
                ['File Format', 'PDF, 2 pages (do not resize)'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 pt-1">
              Print at 100% scale — do not use fit-to-page. Page 1 is the front, page 2 is the back;
              the PDF is pre-sized to CR80.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
