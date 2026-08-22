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
  /** Deployment posting — now shown on the front, after rank. */
  sectorCommand?: string | null
  subSector?: string | null
  unit?: string | null
  issueDate: string
  photoUrl: string
  verifyUrl?: string
  /** Pre-generated QR data URL. When set, skips the internal async fetch
   * (used by capture flows so html2canvas never races the QR image). */
  qrDataUrl?: string | null
  /** Signatures captured by ICT at issue, printed on the back. */
  holderSignatureUrl?: string | null
  officerSignatureUrl?: string | null
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

/**
 * Cards run four years from issue. Derived from the issue date rather than
 * "today + 4" so a reprint of an old card shows the same expiry the original
 * PDF did; falls back to today only when no issue date is readable.
 */
export function cardExpiryDate(issueDate?: string): string {
  const raw = (issueDate ?? '').trim()
  // Card dates are written DD/MM/YYYY, which Date() reads as MM/DD/YYYY — left
  // to the built-in parser, 12/08/2026 expires in December rather than August.
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const issued = dmy
    ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    : raw ? new Date(raw) : new Date()
  const base = Number.isNaN(issued.getTime()) ? new Date() : issued
  const day = String(base.getDate()).padStart(2, '0')
  const month = String(base.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${base.getFullYear() + 4}`
}

/**
 * Guilloche-style security hatch, as an SVG data URI.
 *
 * It has to be an image, not CSS. The card people actually carry is the PDF,
 * and the PDF is an html2canvas raster of these very elements — html2canvas
 * silently drops `repeating-linear-gradient`, so a CSS-drawn pattern looks
 * right in the browser and prints as a flat tint. An <img> is drawn onto the
 * capture canvas like any other image, so what you see is what prints.
 */
function securityPattern({ base, line, fine }: { base: string; line: number; fine: number }): string {
  // Grayscale on purpose: a neutral hatch reads as security printing and stays
  // out of the way of the card's actual colour (green/gold/red), which belongs
  // to the bands, the rank badge and the blood group — not the background.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="327" height="216">
<defs>
<pattern id="a" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<line x1="0" y1="0" x2="0" y2="6" stroke="#2b2b2b" stroke-width="0.8" stroke-opacity="${line}"/>
</pattern>
<pattern id="b" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
<line x1="0" y1="0" x2="0" y2="6" stroke="#2b2b2b" stroke-width="0.8" stroke-opacity="${line * 0.8}"/>
</pattern>
<pattern id="c" width="11" height="11" patternUnits="userSpaceOnUse">
<line x1="0" y1="0" x2="0" y2="11" stroke="#2b2b2b" stroke-width="0.6" stroke-opacity="${fine}"/>
</pattern>
</defs>
<rect width="100%" height="100%" fill="${base}"/>
<rect width="100%" height="100%" fill="url(#a)"/>
<rect width="100%" height="100%" fill="url(#b)"/>
<rect width="100%" height="100%" fill="url(#c)"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// The front carries far more small text than the back, so it gets the same
// hatch geometry at roughly half strength.
const FRONT_PATTERN_BASE = '#e8eae9'
const FRONT_PATTERN = securityPattern({ base: FRONT_PATTERN_BASE, line: 0.07, fine: 0.04 })

/**
 * Blood group with the rhesus sign raised, e.g. O with a small high +.
 *
 * Done with flex alignment rather than `vertical-align: super`, which
 * html2canvas positions inconsistently — the sign is its own box aligned to the
 * top of the row, so screen and print agree.
 */
function BloodGroupValue({ value, size }: { value: string; size: number }) {
  const match = value.trim().match(/^(.*?)\s*([+-])$/)
  const letters = match ? match[1] : value.trim()
  const sign = match ? match[2] : ''
  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', lineHeight: 1 }}>
      <span style={{ fontSize: size, fontWeight: 800, color: C.red, lineHeight: 1.15 }}>{letters}</span>
      {sign && (
        <span style={{ fontSize: size * 0.55, fontWeight: 800, color: C.red, lineHeight: 1.15, marginLeft: 0.5 }}>{sign}</span>
      )}
    </div>
  )
}

function SmallField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 5.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.3, margin: 0, lineHeight: 1 }}>{label}</p>
      <p style={{ fontSize: 7.5, color: C.black, fontWeight: 600, margin: '1px 0 0 0', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

/** Compact label/value line for the deployment posting on the card face. */
function PostingField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 4.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, flexShrink: 0, width: 58, lineHeight: 1.15 }}>{label}</span>
      <span style={{ fontSize: 6.5, color: C.black, fontWeight: 600, lineHeight: 1.15 }}>{value}</span>
    </div>
  )
}

export function IdCardPreview({
  fullName, cjtfId, stateOfOrigin, lga, dateOfBirth, gender, bloodGroup,
  designation = 'VOLUNTEER MEMBER', photoUrl, verifyUrl, qrDataUrl: qrDataUrlProp,
  sectorCommand, subSector, unit,
}: IdCardPreviewProps) {
  const [qrDataUrlState, setQrDataUrlState] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (qrDataUrlProp || !verifyUrl) return
    import('qrcode').then(QRCode => QRCode.toDataURL(verifyUrl, { width: 96, margin: 1 }))
      .then(url => { if (mounted.current) setQrDataUrlState(url) })
      .catch(() => {})
    return () => { mounted.current = false }
  }, [verifyUrl, qrDataUrlProp])

  const qrDataUrl = qrDataUrlProp || qrDataUrlState

  // 342 × 216 px  (≈ 2× CR80)
  const STRIPE = 21   // left stripe total width
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

        {/* Tinted base + the same security hatch as the back, at roughly half
            strength: enough to take the glare off a blank white face without
            competing with the field text sitting on top of it. */}
        <div style={{ position: 'absolute', inset: 0, background: FRONT_PATTERN_BASE, zIndex: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FRONT_PATTERN} alt="" aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />

        {/* Watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cjtf-logo.jpg" alt="" crossOrigin="anonymous"
            style={{ width: 150, height: 150, objectFit: 'contain', opacity: 0.05 }} />
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
            <p style={{ fontSize: 9.5, fontWeight: 700, color: C.white, letterSpacing: 0.5, margin: 0 }}>
              CIVILIAN JOINT TASK FORCE
            </p>
            <p style={{ fontSize: 5.5, color: C.gold, margin: '2px 0 0 0' }}>
              Official Identification Card — Federal Republic of Nigeria
            </p>
          </div>
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

            {/* Blood group sits directly under the photo, deliberately the
                boldest small field on the card — it is the one value a medic
                needs to read at a glance in an emergency, so it gets a boxed
                red chip rather than another grey label/value pair. */}
            {bloodGroup && (
              <div style={{ marginTop: 3, width: 64, textAlign: 'center' }}>
                <p style={{ fontSize: 5, color: C.red, textTransform: 'uppercase', letterSpacing: 0.6, margin: 0, fontWeight: 700, lineHeight: 1.4 }}>Blood Group</p>
                <BloodGroupValue value={bloodGroup} size={19} />
              </div>
            )}
          </div>

          {/* Details column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.black, margin: 0, lineHeight: 1.15 }}>{fullName}</p>
            <p style={{ fontSize: 8, fontWeight: 700, color: C.green, letterSpacing: 0.3, margin: '1px 0 2px 0' }}>{cjtfId}</p>

            {/* Rank — plain, no border so the posting fields have room. */}
            <div style={{ margin: '0 0 1px 0' }}>
              <span style={{ fontSize: 5.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, lineHeight: 1.2 }}>Rank&nbsp;</span>
              <span style={{ fontSize: 7.5, color: C.green, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.2 }}>{designation}</span>
            </div>

            <PostingField label="Sector Command" value={sectorCommand} />
            <PostingField label="Sub Sector" value={subSector} />
            <PostingField label="Unit" value={unit} />

            {/* Small fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 8px', marginTop: 2 }}>
              <SmallField label="Date of Birth" value={dateOfBirth || '—'} />
              <SmallField label="Gender" value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '—'} />
              <SmallField label="State of Origin" value={stateOfOrigin} />
              <SmallField label="LGA" value={lga} />
            </div>
          </div>

          {/* QR column */}
          <div style={{ width: 50, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <div style={{
              background: '#fff', padding: 2, borderRadius: 2,
              border: `1px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR" style={{ width: 44, height: 44, display: 'block' }} />
              ) : (
                <div style={{ width: 44, height: 44, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: verifyUrl ? 5 : 7, color: '#9ca3af' }}>
                  {verifyUrl ? 'Loading…' : 'QR'}
                </div>
              )}
            </div>
            <p style={{ fontSize: 5, color: C.grey, textAlign: 'center', margin: 0 }}>Scan to{'\n'}Verify</p>

            {/* Ghosted repeat of the passport photo beneath the QR — a cheap
                tamper check. */}
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" crossOrigin="anonymous"
                style={{ width: 34, height: 40, objectFit: 'cover', opacity: 0.16, borderRadius: 1 }} />
            )}
          </div>
        </div>

        {/* GREEN FOOTER */}
        <div style={{
          height: 18, background: C.green, position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px',
        }}>
          <p style={{ fontSize: 4.5, color: C.white, margin: 0 }}>Property of CJTF Nigeria. If found, return to nearest CJTF office.</p>
          <p style={{ fontSize: 4.5, color: C.gold, margin: 0, fontWeight: 700 }}>ISSUING AUTHORITY: CJTF NIGERIA</p>
        </div>

        {/* BLACK BOTTOM STRIPE */}
        <div style={{ height: 5, background: C.black, position: 'relative', zIndex: 1 }} />
      </div>
    </div>
  )
}


// ── Back-face security pattern ────────────────────────────────────────────
// Stronger than the front — the back has room for it — and kept as a module
// constant so every surface that renders a card back gets the identical tone.
const PATTERN_BASE = '#dcdedd'
const BACK_PATTERN = securityPattern({ base: PATTERN_BASE, line: 0.11, fine: 0.06 })

/** One ruled signature line, with the captured signature sitting on it. */
function SignatureSlot({ label, src }: { label: string; src?: string | null }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        borderBottom: `1px solid ${C.grey}`, height: 13,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" crossOrigin="anonymous"
            style={{ maxWidth: '100%', maxHeight: 12.5, objectFit: 'contain', display: 'block' }} />
        )}
      </div>
      <p style={{ fontSize: 4.5, color: C.grey, margin: '1px 0 0 0' }}>{label}</p>
    </div>
  )
}

function BackField({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 4, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.4, margin: 0 }}>{label}</p>
      <p style={{
        fontSize: accent ? 6.5 : 5.5,
        fontWeight: 700,
        color: accent ? C.green : C.black,
        margin: '0.5px 0 0 0',
        lineHeight: 1.15,
      }}>{value}</p>
    </div>
  )
}

export interface IdCardBackPreviewProps {
  cjtfId: string
  designation?: string
  issueDate?: string
  expiryDate?: string
  /** Signature images (PNG data URL or public URL), captured by ICT at issue. */
  holderSignatureUrl?: string | null
  officerSignatureUrl?: string | null
}

// Trimmed to the three that carry legal weight. The back used to run these long
// and then leave half the card empty; shorter lines let the reference block and
// signatures fit above the fold instead.
const TERMS = [
  'Non-transferable. Remains the property of CJTF Nigeria.',
  'Surrender on demand to an authorized CJTF or law enforcement officer.',
  'Report loss or theft immediately to the nearest CJTF office.',
]

export function IdCardBackPreview({
  cjtfId, designation, issueDate,
  expiryDate = cardExpiryDate(issueDate),
  holderSignatureUrl, officerSignatureUrl,
}: IdCardBackPreviewProps) {
  // Same footprint as the front so the two pages line up when printed.
  const STRIPE = 21
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
      <div style={{ width: MAIN_W, height: CARD_H, display: 'flex', flexDirection: 'column', position: 'relative', background: PATTERN_BASE }}>

        {/* Guilloche-style security pattern. A blank white back reads as a
            photocopy; the crossed hatch gives the card a printed-document
            surface and makes a flatbed copy visibly coarser than the original.
            Built from repeating-linear-gradients only — html2canvas renders
            those faithfully during the PDF capture, unlike conic/radial. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BACK_PATTERN} alt="" aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />

        {/* Watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cjtf-logo.jpg" alt="" crossOrigin="anonymous"
            style={{ width: 168, height: 168, objectFit: 'contain', opacity: 0.09 }} />
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

        {/* BODY — two columns so the card's height is actually used: reference
            data on the left, terms on the right, signatures pinned underneath. */}
        <div style={{ flex: 1, padding: '6px 8px 3px 8px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flex: 1 }}>

            {/* Holder reference block. The translucent panel keeps the text
                legible where it crosses the hatch pattern. */}
            <div style={{
              width: 116, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2.5,
              background: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(43,43,43,0.16)', borderRadius: 3, padding: '3px 4px',
            }}>
              {/* Name and blood group live on the front only — repeating them
                  here just crowded the face that carries the conditions. */}
              {designation && <BackField label="Rank" value={designation} accent />}
              <div style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
                {issueDate && <div style={{ flex: 1 }}><BackField label="Issued" value={issueDate} /></div>}
                {expiryDate && <div style={{ flex: 1 }}><BackField label="Expires" value={expiryDate} /></div>}
              </div>
              <BackField label="CJTF ID" value={cjtfId} />

              {/* Fills what was dead space under the reference block, and puts the
                  recovery instruction on the face someone actually turns over. */}
              <div style={{ marginTop: 'auto', paddingTop: 3 }}>
                <p style={{ fontSize: 4, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.4, margin: 0 }}>If Found</p>
                <p style={{ fontSize: 4.8, color: C.black, margin: '0.5px 0 0 0', lineHeight: 1.25 }}>
                  Return to the nearest CJTF office or hand to any police station.
                </p>
              </div>
            </div>

            {/* Vertical rule keeps the two columns visually distinct now that
                both are dense. */}
            <div style={{ width: 1, background: '#e5e7eb', flexShrink: 0 }} />

            {/* Terms */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5,
              background: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(43,43,43,0.16)', borderRadius: 3, padding: '3px 4px',
            }}>
              <p style={{ fontSize: 4.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Conditions of Use</p>
              {TERMS.map((t) => (
                <p key={t} style={{ fontSize: 5, color: C.black, margin: 0, lineHeight: 1.3 }}>&bull;&nbsp; {t}</p>
              ))}

              {/* Verification pointer — the back is where someone checks the card
                  is real, so tell them how without needing the QR on the front. */}
              <div style={{ marginTop: 'auto', paddingTop: 3 }}>
                <p style={{ fontSize: 4, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.4, margin: 0 }}>Verify This Card</p>
                <p style={{ fontSize: 4.8, color: C.black, margin: '0.5px 0 0 0', lineHeight: 1.25 }}>
                  Quote the CJTF ID to any CJTF office to confirm this card.
                </p>
              </div>
            </div>
          </div>

          {/* Signature strip — compact, sits on the baseline */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 14, paddingBottom: 2 }}>
            <SignatureSlot label="Holder&apos;s Signature" src={holderSignatureUrl} />
            <SignatureSlot label="Issuing Officer &amp; Stamp" src={officerSignatureUrl} />
          </div>
        </div>

        {/* GREEN FOOTER */}
        <div style={{
          height: 18, background: C.green, position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px',
        }}>
          <p style={{ fontSize: 4.5, color: C.white, margin: 0 }}>This card remains the property of CJTF Nigeria.</p>
          <p style={{ fontSize: 4.5, color: C.gold, margin: 0, fontWeight: 700 }}>CIVILIAN JOINT TASK FORCE &mdash; NIGERIA</p>
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
              <IdCardBackPreview
                cjtfId={cjtfId}
                designation={props.designation}
                issueDate={props.issueDate}
                holderSignatureUrl={props.holderSignatureUrl}
                officerSignatureUrl={props.officerSignatureUrl}
              />
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
