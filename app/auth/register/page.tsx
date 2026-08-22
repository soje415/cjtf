import { redirect } from 'next/navigation'

// Public self-registration no longer exists — the portal is staff-only.
// Send any lingering "register" links straight to the staff sign-in.
export default function RegisterPage() {
  redirect('/auth/login')
}
