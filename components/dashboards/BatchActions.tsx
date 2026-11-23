'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BatchStatus } from '@/lib/print-batches'

interface Props {
  batchId: string
  batchNo: string
  status: BatchStatus
  role: string
  cardUrls: string[]
  /** applicants in the batch */
  cardCount: number
  /** how many of them already have a generated card */
  generatedCount: number
}

export default function BatchActions({ batchId, batchNo, status, role, cardUrls, cardCount, generatedCount }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [reason, setReason] = useState('')
  const [downloaded, setDownloaded] = useState(false)

  async function act(action: string, note?: string, okMsg?: string) {
    setBusy(action)
    try {
      const res = await fetch(`/api/print-batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(json.error ?? 'Action failed.')
      else {
        if (okMsg) toast.success(okMsg)
        router.refresh()
      }
      return res.ok
    } catch {
      toast.error('Network error. Please try again.')
      return false
    } finally {
      setBusy(null)
    }
  }

  // Merge every card's saved front/back PDF into one print file, in the browser
  // (a server response this large would exceed the hosting limit).
  async function downloadPrintFile() {
    if (cardUrls.length === 0) { toast.error('No card files to print.'); return }
    setBusy('download')
    try {
      const { PDFDocument } = await import('pdf-lib')
      const merged = await PDFDocument.create()
      let done = 0
      const failed: string[] = []
      const CHUNK = 5
      for (let i = 0; i < cardUrls.length; i += CHUNK) {
        const slice = cardUrls.slice(i, i + CHUNK)
        const buffers = await Promise.all(
          slice.map(async (u) => {
            try {
              const r = await fetch(u)
              if (!r.ok) throw new Error(String(r.status))
              return await r.arrayBuffer()
            } catch { failed.push(u); return null }
          })
        )
        for (const buf of buffers) {
          if (!buf) continue
          const src = await PDFDocument.load(buf)
          const pages = await merged.copyPages(src, src.getPageIndices())
          pages.forEach((p) => merged.addPage(p))
        }
        done += slice.length
        setProgress(`Preparing ${Math.min(done, cardUrls.length)} / ${cardUrls.length}…`)
      }
      if (failed.length) {
        toast.error(`${failed.length} card file(s) could not be loaded. Retry, or check those cards.`)
        if (failed.length === cardUrls.length) return
      }
      const bytes = await merged.save()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${batchNo}-id-cards.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      setDownloaded(true)
      await fetch(`/api/print-batches/${batchId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'downloaded', note: `${cardUrls.length - failed.length} card(s)` }),
      }).catch(() => {})
      toast.success('Print file ready.')
    } catch (e) {
      toast.error('Could not build the print file. ' + (e instanceof Error ? e.message : ''))
    } finally {
      setProgress('')
      setBusy(null)
    }
  }

  const isIct = role === 'ict'
  const isAdmin = role === 'admin'
  const isInt = role === 'int'
  const disabled = !!busy
  const allGenerated = cardCount > 0 && generatedCount === cardCount

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {status === 'with_admin' && isAdmin && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">INT sent this batch for your review. Forward it to ICT to start ID generation, or return it to INT.</p>
            <input
              type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
              placeholder="Note (optional for forwarding, shown to INT if returned)"
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={disabled} className="bg-cjtf-green hover:bg-cjtf-green-dark"
                onClick={async () => { if (await act('forward', reason, 'Batch forwarded to ICT.')) setReason('') }}>
                {busy === 'forward' ? 'Forwarding…' : 'Forward to ICT'}
              </Button>
              <Button variant="outline" disabled={disabled} className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={async () => {
                  if (!confirm('Return this batch to INT? Its applicants go back to the INT queue.')) return
                  if (await act('return', reason, 'Batch returned to INT.')) setReason('')
                }}>
                {busy === 'return' ? 'Returning…' : 'Return to INT'}
              </Button>
            </div>
          </div>
        )}

        {status === 'with_admin' && !isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-600">Waiting for Admin to review and forward this batch to ICT.</p>
            {isInt && (
              <Button
                variant="outline" disabled={disabled} className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => {
                  if (!confirm('Cancel this batch? Its applicants go back to the queue.')) return
                  act('cancel', undefined, 'Batch cancelled.')
                }}
              >
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel batch'}
              </Button>
            )}
          </div>
        )}

        {status === 'with_ict' && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">{generatedCount} / {cardCount}</span> ID cards generated.
            {isIct && !allGenerated && ' Open each applicant below to generate their ID.'}
            {!isIct && ' ICT is generating the IDs.'}
          </p>
        )}

        {status === 'with_ict' && isIct && (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={downloadPrintFile} disabled={disabled || cardUrls.length === 0} className="bg-cjtf-green hover:bg-cjtf-green-dark">
              {busy === 'download' ? progress || 'Preparing…' : `Download print file (${cardUrls.length} cards, PDF)`}
            </Button>
            <Button
              variant="outline"
              disabled={disabled || !allGenerated}
              onClick={() => {
                if (!downloaded && !confirm('You have not downloaded the print file in this session. Mark as printed anyway?')) return
                act('printed', undefined, 'Batch marked as printed.')
              }}
            >
              {busy === 'printed' ? 'Saving…' : 'Mark as printed'}
            </Button>
            {!allGenerated && <p className="w-full text-xs text-amber-700">Generate every applicant&apos;s ID before marking the batch printed.</p>}
            <p className="w-full text-xs text-gray-500">Each card is two pages (front then back), CR80 size — print duplex or two-sided on the badge printer.</p>
          </div>
        )}

        {status === 'with_ict' && isAdmin && (
          <div>
            <Button
              variant="outline"
              disabled={disabled}
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => {
                if (!confirm('Cancel this batch? Its applicants go back to the queue. Cards already generated are kept.')) return
                act('cancel', undefined, 'Batch cancelled.')
              }}
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel batch'}
            </Button>
          </div>
        )}

        {status === 'printed' && (
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={disabled} onClick={() => act('collected', undefined, 'Batch marked as collected.')} className="bg-cjtf-green hover:bg-cjtf-green-dark">
              {busy === 'collected' ? 'Saving…' : 'Mark as collected'}
            </Button>
            {isIct && (
              <Button variant="outline" disabled={disabled || cardUrls.length === 0} onClick={downloadPrintFile}>
                {busy === 'download' ? progress || 'Preparing…' : 'Download print file again'}
              </Button>
            )}
          </div>
        )}

        {(status === 'printed' || status === 'collected') && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Request a reprint</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
                placeholder="Reason (e.g. misprint, damaged cards)"
                className="flex-1 min-w-[220px] border rounded px-3 py-1.5 text-sm"
              />
              <Button
                variant="outline" disabled={disabled || !reason.trim()}
                onClick={async () => { if (await act('reprint', reason, 'Sent back to ICT for reprint.')) setReason('') }}
              >
                {busy === 'reprint' ? 'Sending…' : 'Send back for reprint'}
              </Button>
            </div>
          </div>
        )}

        {status === 'collected' && <p className="text-sm text-green-700">This batch has been collected.</p>}
        {status === 'cancelled' && <p className="text-sm text-gray-500">This batch was cancelled.</p>}
      </CardContent>
    </Card>
  )
}
