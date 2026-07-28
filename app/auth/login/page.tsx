import Image from 'next/image'
import Link from 'next/link'
import LoginForm from './LoginForm'

const ROLES = [
  {
    key: 'applicant',
    title: 'Applicant',
    description: 'New recruits and returning applicants checking application status.',
    accent: '#008751',
    iconBg: '#dcfce7',
    icon: '👤',
  },
  {
    key: 'ict',
    title: 'ICT Officer',
    description: 'Data verification staff reviewing submitted applications.',
    accent: '#09ADE2',
    iconBg: '#e0f2fe',
    icon: '🖥️',
  },
  {
    key: 'int',
    title: 'Intelligence Officer',
    description: 'Security screening and background clearance officers.',
    accent: '#7c3aed',
    iconBg: '#ede9fe',
    icon: '🔍',
  },
  {
    key: 'admin',
    title: 'Admin / Command',
    description: 'Command authority for final approval and oversight.',
    accent: '#ea580c',
    iconBg: '#ffedd5',
    icon: '⭐',
  },
  {
    key: 'executive',
    title: 'Executive / DSS',
    description: 'Read-only oversight access for Executive and DSS review.',
    accent: '#334155',
    iconBg: '#e2e8f0',
    icon: '🛡️',
  },
]

const ROLE_LABELS: Record<string, { label: string; sub: string; accent: string; back: string }> = {
  applicant: { label: 'Applicant Portal',       sub: 'Sign in to track your application',          accent: '#008751', back: 'linear-gradient(135deg,#008751 0%,#006b40 100%)' },
  ict:       { label: 'ICT Officer Login',       sub: 'Sign in to access the verification queue',   accent: '#09ADE2', back: 'linear-gradient(135deg,#09ADE2 0%,#0790BC 100%)' },
  int:       { label: 'Intelligence Login',      sub: 'Sign in to access the screening queue',      accent: '#7c3aed', back: 'linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)' },
  admin:     { label: 'Admin / Command Login',   sub: 'Sign in to access the approval dashboard',   accent: '#ea580c', back: 'linear-gradient(135deg,#ea580c 0%,#c2410c 100%)' },
  executive: { label: 'Executive / DSS Login',    sub: 'Sign in to access the oversight dashboard',  accent: '#334155', back: 'linear-gradient(135deg,#334155 0%,#1e293b 100%)' },
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { role?: string; error?: string }
}) {
  const role = searchParams.role
  const roleConfig = role ? ROLE_LABELS[role] : null

  // ── Role picker ──────────────────────────────────────────────────────────
  if (!roleConfig) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0a1628 0%,#0d2137 100%)' }}>
        {/* Flag stripe */}
        <div className="h-2 flex">
          <div className="flex-1" style={{ background: '#09ADE2' }} />
          <div className="flex-1" style={{ background: '#FFF110' }} />
          <div className="flex-1" style={{ background: '#EE3135' }} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          {/* Logo + title */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <Image
                src="/cjtf-logo.jpg"
                alt="CJTF Nigeria"
                width={88}
                height={88}
                className="rounded-full border-4 shadow-2xl"
                style={{ borderColor: '#FFF110' }}
              />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Civilian Joint Task Force</h1>
            <p className="text-sm font-semibold mt-1" style={{ color: '#FFF110' }}>Official Recruitment Portal</p>
            <p className="text-xs text-white/50 mt-2">Select your role to continue</p>
          </div>

          {/* Role cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
            {ROLES.map((r) => (
              <Link
                key={r.key}
                href={`/auth/login?role=${r.key}`}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-2xl p-5 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: r.iconBg }}
                  >
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-base group-hover:underline" style={{ color: r.accent === '#008751' ? '#4ade80' : r.accent === '#09ADE2' ? '#7dd3fc' : r.accent === '#7c3aed' ? '#c4b5fd' : '#fdba74' }}>
                      {r.title}
                    </p>
                    <p className="text-white/50 text-xs mt-1 leading-snug">{r.description}</p>
                  </div>
                  <span className="text-white/30 group-hover:text-white/70 transition-colors text-lg mt-1">→</span>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-white/30 text-xs mt-10">
            New applicant?{' '}
            <Link href="/auth/register" className="text-white/60 hover:text-white underline">
              Register here
            </Link>
          </p>
        </div>

        <div className="text-center pb-4 text-xs text-white/30">
          Civilian Joint Task Force Nigeria — Official Recruitment System
        </div>
      </div>
    )
  }

  // ── Login form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: roleConfig.back }}>
      <div className="h-2 flex">
        <div className="flex-1" style={{ background: '#09ADE2' }} />
        <div className="flex-1" style={{ background: '#FFF110' }} />
        <div className="flex-1" style={{ background: '#EE3135' }} />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 pb-0 text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/cjtf-logo.jpg"
                alt="CJTF Nigeria"
                width={80}
                height={80}
                className="rounded-full border-4 shadow-lg"
                style={{ borderColor: '#FFF110' }}
              />
            </div>
            <h1 className="text-lg font-bold text-gray-800">{roleConfig.label}</h1>
            <p className="text-xs text-gray-500 mt-1">{roleConfig.sub}</p>
          </div>

          <div className="p-8">
            {searchParams.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                {searchParams.error}
              </div>
            )}

            <LoginForm accentColor={roleConfig.accent} />

            {role === 'applicant' && (
              <p className="text-center text-sm text-gray-500 mt-4">
                New applicant?{' '}
                <Link href="/auth/register" className="font-medium hover:underline" style={{ color: roleConfig.accent }}>
                  Register here
                </Link>
              </p>
            )}

            <p className="text-center text-xs text-gray-400 mt-3">
              <Link href="/auth/login" className="hover:underline">← Back to role selection</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pb-4 text-xs text-white/60">
        Civilian Joint Task Force Nigeria — Official Recruitment System
      </div>
    </div>
  )
}
