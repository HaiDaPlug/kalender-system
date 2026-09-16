import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned actions (buttons, filters). */
  actions?: ReactNode
  /** Small element rendered before the title, e.g. a back button. */
  leading?: ReactNode
  className?: string
}

// Consistent page heading: title on the left, actions on the right, wraps on narrow screens.
export function PageHeader({ title, subtitle, actions, leading, className }: Props) {
  return (
    <div className={cn('flex items-start justify-between gap-4 flex-wrap', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {leading}
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2.5 flex-wrap">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
