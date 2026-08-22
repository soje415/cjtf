import { notFound } from 'next/navigation'
import { IdCardPreview, IdCardBackPreview } from '@/components/id-card/IdCardDownload'
import CaptureCheck from './CaptureCheck'

/**
 * Design-review harness for the ID card, with fixed sample data.
 *
 * Exists so the card can be looked at without pushing a real application all
 * the way through payment → ICT → INT → admin → training just to see a layout
 * change. Dev-only: 404s in production so it never ships a fake card.
 */
const SAMPLE_SIG = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22220%22%20height%3D%2260%22%3E%3Cpath%20d%3D%22M8%2044%20C%2030%208%2C%2044%2052%2C%2062%2030%20S%2092%206%2C%20108%2034%20C%20120%2054%2C%20140%2012%2C%20158%2032%20C%20170%2044%2C%20186%2030%2C%20210%2018%22%20fill%3D%22none%22%20stroke%3D%22%231a1a1a%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22round%22/%3E%3C/svg%3E'

export default function CardPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const sample = {
    fullName: 'MUSA IBRAHIM AHMADU',
    cjtfId: 'CJTF/2026/00001',
    stateOfOrigin: 'Borno',
    lga: 'Maiduguri',
    dateOfBirth: '14/03/1992',
    gender: 'male',
    bloodGroup: 'O+',
    designation: 'CHIEF INSPECTOR',
    sectorCommand: 'KUBWA',
    subSector: 'FO1',
    unit: '002',
    issueDate: '12/08/2026',
    photoUrl: '/cjtf-logo.jpg',
    verifyUrl: 'https://cjtf.vercel.app/verify/sample',
  }

  return (
    <div style={{ padding: 32, background: '#f3f4f6', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>ID Card — design preview</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Sample data. Shown at 2× card size (342×216px ≈ CR80).
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>FRONT</p>
          <IdCardPreview {...sample} />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>BACK</p>
          <IdCardBackPreview
            cjtfId={sample.cjtfId}
            designation={sample.designation}
            issueDate={sample.issueDate}
            holderSignatureUrl={SAMPLE_SIG}
            officerSignatureUrl={SAMPLE_SIG}
          />
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <CaptureCheck {...sample} signature={SAMPLE_SIG} />
      </div>
    </div>
  )
}
