'use client'

import { useEffect, useState } from 'react'
import OperationalPermit from '@/components/certificate/OperationalPermit'

/**
 * Sample-data preview of the office-flow Operational Permit.
 * Same component ICT renders when issuing a real permit, shown with dummy
 * data so the layout can be reviewed without pushing a registration through.
 */
const SAMPLE = {
  fullName: 'ALHAJI MUSA IBRAHIM AHMADU',
  officeAddress: 'Garki 2, Area 3 Junction, Garki District, Abuja',
  officeName: 'Garki Zonal Office',
  permitNumber: 'CJTF-OFC-2026-00001',
  dateIssued: '20 August 2026',
}

export default function PermitPreviewClient() {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL('https://cjtfnigeria.com/verify/office/sample', { width: 150, margin: 1 }))
      .then(setQr)
      .catch(() => {})
  }, [])

  return (
    <div style={{ padding: 24, background: '#e9e9e9', minHeight: '100vh' }}>
      <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#555', marginBottom: 16 }}>
        Operational Permit — dummy data (sample). Full-size A4 landscape.
      </p>
      <OperationalPermit {...SAMPLE} qrDataUrl={qr} />
    </div>
  )
}
