'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Printer, Layers, LogOut, UserRound } from 'lucide-react'
import { toast } from 'sonner'

export type StaffRole = 'int' | 'admin' | 'ict'

const BATCHES = { label: 'Print Batches', href: '/portal/staff/print', icon: Layers, title: 'Print Batches' }

const DESKS = {
  int: {
    department: 'INTELLIGENCE DEPARTMENT',
    officer: 'Intelligence Officer',
    fallbackTitle: 'Intelligence Screening',
    links: [
      { label: 'Dashboard', href: '/portal/int/dashboard', icon: LayoutDashboard, title: 'Intelligence Screening Dashboard' },
      { label: 'Print Queue', href: '/portal/int/print-queue', icon: Printer, title: 'Print Queue' },
      BATCHES,
    ],
  },
  admin: {
    department: 'ADMINISTRATION DEPARTMENT',
    officer: 'Admin Officer',
    fallbackTitle: 'Approval Review',
    links: [
      { label: 'Dashboard', href: '/portal/admin/dashboard', icon: LayoutDashboard, title: 'Admin Approval Dashboard' },
      { label: 'Print Queue', href: '/portal/admin/print-queue', icon: Printer, title: 'Print Queue' },
      BATCHES,
    ],
  },
  ict: {
    department: 'ICT DEPARTMENT',
    officer: 'ICT Officer',
    fallbackTitle: 'ICT Records',
    links: [
      { label: 'Dashboard', href: '/portal/ict/dashboard', icon: LayoutDashboard, title: 'ICT Processing Dashboard' },
      BATCHES,
    ],
  },
}

export default function StaffShell({ role, name, children }: { role: StaffRole; name: string | null; children: React.ReactNode }) {
  const pathname = usePathname()
  const desk = DESKS[role]
  const title = desk.links.find((l) => pathname.startsWith(l.href))?.title ?? desk.fallbackTitle

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Signed out')
    window.location.href = '/auth/login'
  }

  const item = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="print:hidden bg-gradient-to-r from-[#061d4f] to-[#0b357f] text-white shadow-md">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link href={desk.links[0].href} className="flex items-center gap-3">
            <Image src="/cjtf-logo.jpg" alt="CJTF Logo" width={40} height={40} className="rounded-full border-2 border-cjtf-yellow" />
            <div>
              <p className="text-lg md:text-xl font-extrabold leading-none tracking-wide">CJTF NIGERIA</p>
              <p className="mt-1 text-[11px] md:text-xs font-bold leading-none text-cjtf-yellow">{desk.department}</p>
            </div>
          </Link>
          <p className="hidden lg:block border-l border-white/30 pl-5 text-xl font-bold">{title}</p>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0b357f]">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-tight">{name || desk.officer}</p>
              <p className="text-xs text-blue-200 leading-tight">FCT COMMAND</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="print:hidden bg-[#0a2559] text-blue-100 md:w-44 md:shrink-0">
          <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3">
            {desk.links.map((l) => {
              const active = pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                  className={`${item} ${active ? 'bg-blue-600 text-white' : 'hover:bg-white/10'}`}
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                </Link>
              )
            })}
            <button type="button" onClick={handleLogout} className={`${item} md:mt-3 md:rounded-none md:border-t md:border-white/20 md:pt-4 hover:bg-white/10`}>
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </nav>
        </aside>
        {/* The shared Card component renders without inner padding on this
            Tailwind version, so the staff screens restore it here. */}
        <main className="min-w-0 flex-1 p-4 [&_[data-slot=card-content]]:px-5 [&_[data-slot=card-header]]:px-5 [&_[data-slot=card]]:py-4">
          {children}
        </main>
      </div>
    </div>
  )
}
