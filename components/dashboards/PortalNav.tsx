'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Profile, Role } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const RECRUITMENT_LINKS = [
  { label: 'Dashboard', href: '/portal/applicant/dashboard' },
  { label: 'My Application', href: '/portal/applicant/application' },
  { label: 'Payment', href: '/portal/applicant/payment' },
  { label: 'ID Card', href: '/portal/applicant/id-card' },
]

const OFFICE_LINKS = [
  { label: 'Office Registration', href: '/portal/applicant/office' },
]

const NAV_LINKS: Record<Exclude<Role, 'applicant'>, { label: string; href: string }[]> = {
  ict: [
    { label: 'Dashboard', href: '/portal/ict/dashboard' },
  ],
  int: [
    { label: 'Dashboard', href: '/portal/int/dashboard' },
  ],
  admin: [
    { label: 'Dashboard', href: '/portal/admin/dashboard' },
  ],
  executive: [
    { label: 'Oversight', href: '/portal/executive/dashboard' },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  applicant: 'Applicant',
  ict: 'ICT Officer',
  int: 'Intelligence Officer',
  admin: 'Admin Officer',
  executive: 'Executive Oversight',
}

export default function PortalNav({
  profile,
  hasOfficeReg = false,
  hasApplication = false,
}: {
  profile: Profile
  hasOfficeReg?: boolean
  hasApplication?: boolean
}) {
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Signed out')
    window.location.href = '/auth/login'
  }

  let links: { label: string; href: string }[]
  if (profile.role === 'applicant') {
    // Office registrants and recruitment applicants share the `applicant`
    // role — pick nav links based on which flow(s) they're actually in,
    // falling back to "currently browsing an office page" for the moment
    // right after signup, before any DB row exists yet.
    const inOfficeFlow = hasOfficeReg
      || pathname.startsWith('/portal/applicant/office')
      || pathname.startsWith('/portal/applicant/certificate')
    const inRecruitmentFlow = hasApplication || !inOfficeFlow
    links = [
      ...(inRecruitmentFlow ? RECRUITMENT_LINKS : []),
      ...(inOfficeFlow ? OFFICE_LINKS : []),
    ]
  } else {
    links = NAV_LINKS[profile.role] || []
  }

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
