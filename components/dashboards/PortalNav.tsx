'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Profile, Role } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const NAV_LINKS: Record<Role, { label: string; href: string }[]> = {
  applicant: [
    { label: 'Dashboard', href: '/portal/applicant/dashboard' },
    { label: 'My Application', href: '/portal/applicant/application' },
    { label: 'Payment', href: '/portal/applicant/payment' },
    { label: 'ID Card', href: '/portal/applicant/id-card' },
  ],
  ict: [
    { label: 'Dashboard', href: '/portal/ict/dashboard' },
  ],
  int: [
    { label: 'Dashboard', href: '/portal/int/dashboard' },
  ],
  admin: [
    { label: 'Dashboard', href: '/portal/admin/dashboard' },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  applicant: 'Applicant',
  ict: 'ICT Officer',
  int: 'Intelligence Officer',
  admin: 'Admin Officer',
}

export default function PortalNav({ profile }: { profile: Profile }) {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Signed out')
    window.location.href = '/auth/login'
  }

  const links = NAV_LINKS[profile.role] || []

  return (
    <header className="bg-cjtf-blue text-white shadow-md">
      {/* CJTF colour stripe */}
      <div className="h-1 flex">
        <div className="flex-1 bg-cjtf-blue" />
        <div className="flex-1 bg-cjtf-yellow" />
        <div className="flex-1 bg-cjtf-red" />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/cjtf-logo.jpg"
              alt="CJTF Logo"
              width={36}
              height={36}
              className="rounded-full border-2 border-cjtf-yellow"
            />
            <div className="hidden sm:block">
              <p className="font-bold text-sm leading-none">CJTF Portal</p>
              <p className="text-xs text-blue-100 leading-none mt-0.5">Civilian Joint Task Force</p>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-cjtf-yellow transition-colors font-medium">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold leading-none">{profile.full_name || 'User'}</p>
            <p className="text-xs text-blue-200 leading-none mt-0.5">{ROLE_LABELS[profile.role]}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-white text-white hover:bg-white/20 text-xs"
            onClick={handleLogout}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}
