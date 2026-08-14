'use client'

import { useEffect, useRef, useState } from 'react'
import { IdCardBackPreview, IdCardPreview } from '@/components/id-card/IdCardDownload'

/**
 * Renders the card the way the ICT capture flow does, then runs the same
 * html2canvas pass and shows the raster.
 *
 * The PDF is what people carry, and it does not always agree with the browser —
 * gradients, CSS filters and tight text boxes have all rendered differently
 * here than on screen. This is where that gets caught, before a card is issued.
 */
export default function CaptureCheck(
  props: React.ComponentProps<typeof IdCardPreview> & { signature?: string }
) {
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const [shots, setShots] = useState<{ front: string; back: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      if (!frontRef.current || !backRef.current) return
      const { default: html2canvas } = await import('html2canvas')
      const opts = { scale: 3, useCORS: true, allowTaint: false, backgroundColor: null, logging: false }
      const [f, b] = await Promise.all([
        html2canvas(frontRef.current, opts),
        html2canvas(backRef.current, opts),
      ])
      if (!cancelled) setShots({ front: f.toDataURL('image/png'), back: b.toDataURL('image/png') })
    }, 900)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  return (
    <div>
      {/* Off-screen capture sources, rendered at true card size. */}
      <div style={{ position: 'absolute', left: -9999, top: 0 }}>
        <div ref={frontRef}><IdCardPreview {...props} /></div>
        <div ref={backRef}>
          <IdCardBackPreview
            cjtfId={props.cjtfId}
            designation={props.designation}
            issueDate={props.issueDate}
            holderSignatureUrl={props.signature}
            officerSignatureUrl={props.signature}
          />
        </div>
      </div>

      <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 8px 0' }}>
        AS CAPTURED FOR THE PDF {shots ? '' : '— capturing…'}
      </p>
      {shots && (
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shots.front} alt="captured front" style={{ width: 342 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shots.back} alt="captured back" style={{ width: 342 }} />
        </div>
      )}
    </div>
  )
}
