'use client'

import { forwardRef } from 'react'

export interface PermitProps {
  fullName: string
  officeAddress: string
  officeName: string
  permitNumber: string
  dateIssued: string
  qrDataUrl?: string | null
}

const NAVY = '#0b1f4e'
const RED = '#a4161a'
const GOLD = '#c9a227'

// A4 landscape at 96dpi ≈ 1123 × 794 px. Rendered at this fixed size and
// captured to a full-page A4 PDF (lib/capture-pdf captureElementAsA4Pdf).
const W = 1123
const H = 794

// A handwriting-style fill line with the value sitting on top of it.
function FillLine({ value }: { value: string }) {
  return (
    <div style={{ position: 'relative', width: '78%', margin: '0 auto', height: 38 }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderBottom: `1.5px solid ${NAVY}` }} />
      <div style={{
        position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center',
        fontSize: 22, color: NAVY, fontWeight: 600,
      }}>{value}</div>
    </div>
  )
}

const OperationalPermit = forwardRef<HTMLDivElement, PermitProps>(function OperationalPermit(
  { fullName, officeAddress, officeName, permitNumber, dateIssued, qrDataUrl }, ref,
) {
  return (
    <div ref={ref} style={{
      width: W, height: H, background: '#fffdf6', position: 'relative',
      fontFamily: 'Georgia, "Times New Roman", serif', color: NAVY,
      boxSizing: 'border-box', overflow: 'hidden',
    }}>
      {/* Corner colour wedges (Nigeria / CJTF palette) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderTop: `90px solid ${RED}`, borderRight: '90px solid transparent' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderTop: `90px solid ${GOLD}`, borderLeft: '90px solid transparent' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 0, height: 0, borderBottom: `90px solid ${GOLD}`, borderRight: '90px solid transparent' }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderBottom: `90px solid ${RED}`, borderLeft: '90px solid transparent' }} />

      {/* Ornate double border */}
      <div style={{ position: 'absolute', inset: 18, border: `3px solid ${GOLD}` }} />
      <div style={{ position: 'absolute', inset: 26, border: `1px solid ${NAVY}` }} />

      {/* Watermark */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cjtf-logo.jpg" alt="" crossOrigin="anonymous"
          style={{ width: 460, height: 460, objectFit: 'contain', opacity: 0.06, filter: 'grayscale(1)' }} />
      </div>

      {/* Content */}
      <div style={{ position: 'absolute', inset: 40, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '6px 30px 0' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/coat-of-arms.jpeg" alt="Federal Republic of Nigeria" crossOrigin="anonymous"
            style={{ width: 86, height: 86, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${GOLD}` }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 1, color: NAVY }}>CIVILIAN JOINT TASK FORCE</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GOLD, margin: '2px 0' }}>— FCT ABUJA HEADQUARTERS —</div>
            <div style={{ fontSize: 14, color: NAVY }}>Opposite Kaita Plaza by SDP Junction G/lada, Abuja</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cjtf-flag.jpeg" alt="CJTF Flag" crossOrigin="anonymous"
            style={{ width: 44, height: 86, borderRadius: 4, objectFit: 'cover', border: `2px solid ${NAVY}` }} />
        </div>

        {/* Title banner */}
        <div style={{ textAlign: 'center', margin: '18px 0 6px' }}>
          <span style={{
            display: 'inline-block', background: RED, color: '#fff', fontWeight: 800,
            fontSize: 26, letterSpacing: 3, padding: '8px 48px', borderRadius: 4,
            border: `2px solid ${GOLD}`,
          }}>OPERATIONAL PERMIT</span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: 18 }}>This is to certify that</div>
          <FillLine value={fullName} />
          <div style={{ textAlign: 'center', fontSize: 17 }}>has been given the approval to open and operate an office at</div>
          <FillLine value={officeAddress} />
          <div style={{ textAlign: 'center', fontSize: 17 }}>under</div>
          <FillLine value={officeName} />
          <div style={{ textAlign: 'center', fontSize: 17 }}>of the Civilian Joint Task Force, FCT Command.</div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 36px 8px' }}>
          {/* Permit no + date */}
          <div style={{ fontSize: 15 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 700, letterSpacing: 1 }}>PERMIT NO. </span>
              <span style={{ borderBottom: `1px solid ${NAVY}`, padding: '0 24px 2px', color: RED, fontWeight: 700 }}>{permitNumber}</span>
            </div>
            <div>
              <span style={{ fontWeight: 700, letterSpacing: 1 }}>DATE ISSUED </span>
              <span style={{ borderBottom: `1px solid ${NAVY}`, padding: '0 24px 2px' }}>{dateIssued}</span>
            </div>
          </div>

          {/* Gold seal */}
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: `radial-gradient(circle at 50% 40%, #e8c75e, ${GOLD})`,
            border: `3px solid #9c7d1e`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 0 8px rgba(0,0,0,0.25)', overflow: 'hidden',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cjtf-logo.jpg" alt="CJTF Seal" crossOrigin="anonymous"
              style={{ width: 74, height: 74, objectFit: 'contain', borderRadius: '50%' }} />
          </div>

          {/* QR verification */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Scan to verify" style={{ width: 66, height: 66, border: `2px solid ${GOLD}`, borderRadius: 4, background: '#fff', padding: 3 }} />
            ) : (
              <div style={{ width: 66, height: 66, border: `1px dashed ${NAVY}`, borderRadius: 4, opacity: 0.4 }} />
            )}
            <div style={{ fontSize: 10, color: NAVY, textAlign: 'center', letterSpacing: 0.5 }}>SCAN TO VERIFY</div>
          </div>

          {/* Signature */}
          <div style={{ textAlign: 'center', fontSize: 15 }}>
            <div style={{ width: 220, borderBottom: `1px solid ${NAVY}`, marginBottom: 4 }} />
            <div style={{ fontWeight: 800 }}>MUSA AHMADU</div>
            <div style={{ color: NAVY }}>FCT COMMANDANT</div>
          </div>
        </div>
      </div>

      {/* Official stamp (bottom-right) */}
      <div style={{
        position: 'absolute', right: 70, bottom: 70, width: 110, height: 110, borderRadius: '50%',
        border: `2px solid ${RED}`, color: RED, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', transform: 'rotate(-12deg)', opacity: 0.85,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700 }}>CJTF • FCT</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>OFFICIAL</div>
        <div style={{ fontSize: 11 }}>ABUJA</div>
      </div>
    </div>
  )
})

export default OperationalPermit
