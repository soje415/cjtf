import { redirect } from 'next/navigation'
import { WEBSITE_URL } from '@/lib/site-links'

// The portal used to serve its own marketing landing page, which competed with the
// public site for the same job. The site is now the only front door, so the portal
// root just hands visitors back to it. `/auth/login` and `/auth/register` stay
// directly reachable — returning applicants must be able to get to their account
// without a round trip through the site.
export default function HomePage() {
  redirect(WEBSITE_URL)
}
