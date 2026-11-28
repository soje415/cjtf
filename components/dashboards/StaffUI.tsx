// Building blocks shared by the Intelligence, Admin and ICT screens, so all
// three desks look the same.
import type { LucideIcon } from 'lucide-react'

export const field = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400'
export const fieldLabel = 'block space-y-1 text-sm font-medium text-slate-700'

export const table = 'w-full text-[13px]'
export const headRow = 'bg-[#0b357f] text-white'
export const th = 'px-2 py-2.5 text-left font-semibold first:rounded-l-md first:pl-3 last:rounded-r-md'
export const td = 'px-2 py-2.5 first:pl-3'
export const tr = 'border-b border-slate-100 last:border-0 even:bg-slate-50/60 hover:bg-blue-50/60'

const solid = 'inline-block whitespace-nowrap rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50'
export const rowButton = solid

const PILL = {
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  violet: 'bg-violet-100 text-violet-800',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
}

export function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tone]}`}>{children}</span>
}

const TONES = {
  blue: { box: 'from-blue-100 to-blue-50 border-blue-200', dot: 'bg-blue-600', text: 'text-slate-900' },
  red: { box: 'from-red-100 to-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-600' },
  amber: { box: 'from-amber-100 to-amber-50 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700' },
  green: { box: 'from-green-100 to-green-50 border-green-200', dot: 'bg-green-600', text: 'text-slate-900' },
  violet: { box: 'from-violet-100 to-violet-50 border-violet-200', dot: 'bg-violet-600', text: 'text-slate-900' },
}

export interface Stat { label: string; value: number; icon: LucideIcon; tone: keyof typeof TONES }

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => {
        const t = TONES[s.tone]
        return (
          <div key={s.label} className={`flex items-center gap-3 rounded-xl border bg-gradient-to-br p-4 shadow-sm ${t.box}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow ${t.dot}`}>
              <s.icon className="h-6 w-6" />
            </span>
            <div>
              <p className={`text-2xl font-extrabold leading-tight ${t.text}`}>{s.value.toLocaleString('en-NG')}</p>
              <p className="text-sm text-slate-700">{s.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Panel({ title, icon: Icon, aside, children, bodyClassName = 'p-3' }: {
  title: string
  icon?: LucideIcon
  /** shown at the right of the title bar */
  aside?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b bg-slate-50 px-5 py-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          {Icon && <Icon className="h-5 w-5 text-[#0b357f]" />} {title}
        </h2>
        {aside && <div className="text-xs text-slate-500">{aside}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>
}
