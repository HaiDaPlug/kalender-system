import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils/cn'
import { bookingStatusMeta, jobStatusMeta, shiftStatusMeta, type StatusMeta } from '@/lib/status'

type Kind = 'booking' | 'job' | 'shift'

interface Props {
  status: string
  kind?: Kind
  size?: 'sm' | 'md'
  className?: string
}

const META_BY_KIND: Record<Kind, (s: string) => StatusMeta> = {
  booking: bookingStatusMeta,
  job:     jobStatusMeta,
  shift:   shiftStatusMeta,
}

// A pill with a glowing dot, colored by status. Server-component safe.
export function StatusBadge({ status, kind = 'booking', size = 'md', className }: Props) {
  const meta = META_BY_KIND[kind](status)
  return (
    <span
      className={cn('badge badge-status', size === 'sm' && 'badge-sm', className)}
      style={{ '--badge-color': meta.color } as CSSProperties}
    >
      {meta.label}
    </span>
  )
}
