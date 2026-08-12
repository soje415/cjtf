import { notFound } from 'next/navigation'
import { IdCardPreview, IdCardBackPreview } from '@/components/id-card/IdCardDownload'

/**
 * Design-review harness for the ID card, with fixed sample data.
 *
 * Exists so the card can be looked at without pushing a real application all
 * the way through payment → ICT → INT → admin → training just to see a layout
 * change. Dev-only: 404s in production so it never ships a fake card.
 */
export default function CardPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const sample = {
    fullName: 'MUSA IBRAHIM AHMADU',
    cjtfId: 'CJTF/2026/00001',
    stateOfOrigin: 'Borno',
    lga: 'Maiduguri',
    dateOfBirth: '14/03/1992',
    gender: 'male',
    nin: '12345678901',
    bloodGroup: 'O+',
    designation: 'VOLUNTEER MEMBER',
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
            fullName={sample.fullName}
            designation={sample.designation}
            bloodGroup={sample.bloodGroup}
            issueDate={sample.issueDate}
          />
        </div>
      </div>
    </div>
  )
}
