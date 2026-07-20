interface Props {
  totalBookings: number
  activeJobs: number
  completedToday: number
}

interface StatCard {
  label: string
  value: number
  delta?: string
  barClass: string
  chipClass: string
  dotClass: string
}

export function DashboardStats({ totalBookings, activeJobs, completedToday }: Props) {
  const stats: StatCard[] = [
    {
      label: 'Totalt bokningar',
      value: totalBookings,
      barClass: 'bg-status-confirmed',
      chipClass: 'bg-status-confirmed/10',
      dotClass: 'bg-status-confirmed',
    },
    {
      label: 'Aktiva jobb',
      value: activeJobs,
      barClass: 'bg-status-in-progress',
      chipClass: 'bg-status-in-progress/10',
      dotClass: 'bg-status-in-progress',
    },
    {
      label: 'Klart idag',
      value: completedToday,
      barClass: 'bg-status-completed',
      chipClass: 'bg-status-completed/10',
      dotClass: 'bg-status-completed',
    },
  ]

  return (
    <div className="grid gap-3 grid-cols-3">
      {stats.map(({ label, value, barClass, chipClass, dotClass }, i) => (
        <div
          key={label}
          className="relative rounded border border-border bg-card p-5 overflow-hidden animate-fade-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Accent bar top */}
          <div className={`absolute top-0 left-0 right-0 h-px ${barClass}`} />

          <p className="label-caps mb-3">{label}</p>

          <div className="flex items-end justify-between">
            <span
              className="text-4xl font-300 tabular leading-none"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </span>
            <div className={`h-8 w-8 rounded flex items-center justify-center mb-0.5 ${chipClass}`}>
              <div className={`h-2 w-2 rounded-full ${dotClass}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
