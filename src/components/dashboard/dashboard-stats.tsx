import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export interface DashboardStat {
  label: string
  value: number
  href: string
  /** CSS color, e.g. 'var(--status-pending)' */
  color: string
}

export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, href, color }, i) => (
        <Link
          key={label}
          href={href}
          className="card group relative p-5 overflow-hidden animate-fade-up hover:border-border-strong transition-colors"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color, opacity: 0.9 }} />

          <div className="flex items-start justify-between gap-2">
            <p className="label-caps">{label}</p>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>

          <div className="mt-3 flex items-end justify-between">
            <span className="text-[2.4rem] font-light tabular leading-none tracking-tight">
              {value}
            </span>
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center mb-0.5"
              style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: color, boxShadow: `0 0 8px color-mix(in srgb, ${color} 70%, transparent)` }}
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
