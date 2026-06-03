interface Props {
  totalBookings: number
  activeJobs: number
  completedToday: number
}

interface StatCard {
  label: string
  value: number
  delta?: string
  accentColor: string
}

export function DashboardStats({ totalBookings, activeJobs, completedToday }: Props) {
  const stats: StatCard[] = [
    {
      label: 'Totalt bokningar',
      value: totalBookings,
      accentColor: '#4A90D9',
    },
    {
      label: 'Aktiva jobb',
      value: activeJobs,
      accentColor: '#8B5CF6',
    },
    {
      label: 'Klart idag',
      value: completedToday,
      accentColor: '#3DAB6A',
    },
  ]

  return (
    <div className="grid gap-3 grid-cols-3">
      {stats.map(({ label, value, accentColor }, i) => (
        <div
          key={label}
          className="relative rounded border border-border bg-card p-5 overflow-hidden animate-fade-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Accent bar top */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: accentColor }}
          />

          <p className="label-caps mb-3">{label}</p>

          <div className="flex items-end justify-between">
            <span
              className="text-4xl font-300 tabular leading-none"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </span>
            <div
              className="h-8 w-8 rounded flex items-center justify-center mb-0.5"
              style={{ background: `${accentColor}18` }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: accentColor }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
