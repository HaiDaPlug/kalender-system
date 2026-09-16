'use client'

import Link from 'next/link'
import type { Booking } from '@/types'
import { formatTime, formatDate } from './calendar-utils'
import { X, User, Car, Phone, MessageSquare, Clock, MapPin, Wrench, ArrowUpRight, MessageCircle } from 'lucide-react'
import { SidePanel } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/status-badge'

interface Props {
  booking: Booking | null
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="label-caps">{title}</p>
      {children}
    </div>
  )
}

export function BookingDetailPanel({ booking, onClose }: Props) {
  return (
    <SidePanel open={booking !== null} onClose={onClose} width="w-[22rem]">
      {booking && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <StatusBadge status={booking.status} />
            <button onClick={onClose} aria-label="Stäng" className="btn btn-ghost btn-icon btn-sm">
              <X />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Service + time */}
            <div>
              <p className="text-base font-semibold leading-tight tracking-tight">{booking.service_type}</p>
              <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs tabular">
                  {formatDate(new Date(booking.scheduled_at), 'long')} · {formatTime(booking.scheduled_at)} · {booking.estimated_duration_minutes} min
                </span>
              </div>
              {booking.location_address && (
                <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-xs">{booking.location_address}</span>
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            <Section title="Kund">
              {booking.customer ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{booking.customer.full_name}</span>
                  </div>
                  {booking.customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={`tel:${booking.customer.phone}`} className="text-sm tabular text-primary hover:underline">
                        {booking.customer.phone}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen kund kopplad</p>
              )}
            </Section>

            <div className="h-px bg-border" />

            <Section title="Bil">
              {booking.car ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{booking.car.make} {booking.car.model}</span>
                  </div>
                  {booking.car.license_plate && (
                    <div className="flex items-center gap-2">
                      <span className="w-3.5" />
                      <span className="plate text-sm text-primary">{booking.car.license_plate}</span>
                      {booking.car.color && <span className="text-xs text-muted-foreground">· {booking.car.color}</span>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen bil kopplad</p>
              )}
            </Section>

            <div className="h-px bg-border" />

            <Section title="Ansvarig">
              {booking.assigned_worker ? (
                <div className="flex items-center gap-2">
                  <div className="avatar avatar-sm">{booking.assigned_worker.full_name.charAt(0)}</div>
                  <span className="text-sm">{booking.assigned_worker.full_name}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Ej tilldelad</p>
              )}
            </Section>

            {booking.customer_notes && (
              <>
                <div className="h-px bg-border" />
                <Section title="Kundönskemål">
                  <div className="flex gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{booking.customer_notes}</p>
                  </div>
                </Section>
              </>
            )}

            {booking.service_notes && (
              <>
                <div className="h-px bg-border" />
                <Section title="Interna anteckningar">
                  <div className="flex gap-2">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{booking.service_notes}</p>
                  </div>
                </Section>
              </>
            )}

            <div className="h-px bg-border" />

            <div className="grid grid-cols-2 gap-3">
              <Section title="SMS-bekräftelse">
                <div className="flex items-center gap-2">
                  <MessageCircle
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: booking.sms_confirmation_sent ? 'var(--status-completed)' : 'var(--status-not-started)' }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {booking.sms_confirmation_sent ? 'Skickad' : 'Ej skickad'}
                  </span>
                </div>
              </Section>
              {booking.creator && (
                <Section title="Inloggad av">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="avatar avatar-sm">{booking.creator.full_name.charAt(0)}</div>
                    <span className="text-sm truncate">{booking.creator.full_name}</span>
                  </div>
                </Section>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-4 border-t border-border">
            <Link href={`/bookings/${booking.id}`} className="btn btn-secondary btn-block">
              Öppna bokning
              <ArrowUpRight />
            </Link>
          </div>
        </>
      )}
    </SidePanel>
  )
}
