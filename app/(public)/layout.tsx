import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-cjtf-green text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cjtf-gold rounded-full flex items-center justify-center font-bold text-cjtf-green text-sm">
              CJTF
            </div>
            <div>
              <p className="font-bold text-sm leading-none">Civilian Joint Task Force</p>
              <p className="text-xs text-green-200 leading-none mt-0.5">Recruitment Portal</p>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/about" className="hover:text-cjtf-gold transition-colors">About</Link>
            <Link href="/auth/login" className="hover:text-cjtf-gold transition-colors">Login</Link>
            <Link
              href="/auth/register"
              className="bg-cjtf-gold text-cjtf-green px-4 py-1.5 rounded font-semibold hover:bg-cjtf-gold-dark transition-colors"
            >
              Apply Now
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-gray-900 text-gray-400 text-center text-xs py-4">
        &copy; {new Date().getFullYear()} Civilian Joint Task Force &mdash; Official Recruitment Portal
      </footer>
    </div>
  )
}
