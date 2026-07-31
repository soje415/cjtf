'use client'

// CR80 card: 85.6 mm × 54 mm
const CR80_W_MM = 85.6
const CR80_H_MM = 54

export async function captureElementAsPdf(element: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 3,          // high-DPI capture
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [CR80_W_MM, CR80_H_MM],
  })

  pdf.addImage(imgData, 'PNG', 0, 0, CR80_W_MM, CR80_H_MM)
  return pdf.output('blob')
}

/** Capture two CR80 elements (front, back) as a 2-page landscape PDF. */
export async function captureFrontAndBackAsPdf(frontEl: HTMLElement, backEl: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const captureOpts = { scale: 3, useCORS: true, allowTaint: false, backgroundColor: null, logging: false }
  const [frontCanvas, backCanvas] = await Promise.all([
    html2canvas(frontEl, captureOpts),
    html2canvas(backEl, captureOpts),
  ])

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CR80_W_MM, CR80_H_MM] })
  pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, CR80_W_MM, CR80_H_MM)
  pdf.addPage([CR80_W_MM, CR80_H_MM], 'landscape')
  pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, CR80_W_MM, CR80_H_MM)
  return pdf.output('blob')
}

// A4 landscape: 297 mm × 210 mm
const A4_W_MM = 297
const A4_H_MM = 210

/** Capture an element as a full A4-landscape PDF (used for the Operational Permit). */
export async function captureElementAsA4Pdf(element: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdf.addImage(imgData, 'PNG', 0, 0, A4_W_MM, A4_H_MM)
  return pdf.output('blob')
}

/** Fetch a remote image as a base64 data URL so html2canvas can render it. */
export async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
