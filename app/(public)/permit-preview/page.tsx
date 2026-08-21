import { notFound } from 'next/navigation'
import PermitPreviewClient from './PermitPreviewClient'

/**
 * Design-review harness for the Operational Permit, with fixed sample data.
 * Dev-only: 404s in production so it never ships a fake permit (mirrors the
 * card-preview page).
 */
export default function PermitPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <PermitPreviewClient />
}
