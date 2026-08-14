'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

/**
 * Signature capture for the ID card back.
 *
 * Two ways in, because the two signatures are collected differently in
 * practice: the applicant is standing at the desk and signs with a finger or
 * mouse, while an issuing officer usually already has a scan of their
 * signature on file. Either path produces a transparent PNG data URL.
 */
export default function SignaturePad({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState('')

  // Canvas is sized in device pixels so the captured signature stays crisp
  // when it is scaled down onto a 54 mm card.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a1a'
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    drawing.current = true
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    dirty.current = true
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    if (dirty.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    setUploadError('')
    onChange(null)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Choose an image file (PNG or JPG).')
      return
    }
    if (file.size > 2_000_000) {
      setUploadError('That image is over 2 MB — use a smaller scan.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setUploadError('')
      onChange(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  const uploaded = value && !dirty.current

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}

      {uploaded ? (
        <div className="border rounded-lg bg-white h-[110px] flex items-center justify-center p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="border rounded-lg bg-white w-full h-[110px] touch-none cursor-crosshair"
        />
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>Clear</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Upload image
        </Button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        {value && <span className="text-xs text-cjtf-green">Captured ✓</span>}
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
    </div>
  )
}
