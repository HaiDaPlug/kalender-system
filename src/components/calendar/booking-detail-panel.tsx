'use client'

import Link from 'next/link'
import type { Booking } from '@/types'
import { STATUS_CONFIG, formatTime, formatDate } from './calendar-utils'
import { X, User, Car, Phone, MessageSquare, Clock, MapPin, Wrench } from 'lucide-react'
import { SidePanel } from '@/components/ui/modal'

interface Props {
  booking: Booking | null
  onClose: () => void
}

export function BookingDetailPanel({ booking, onClose }: Props) {
  const cfg = booking ? (STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending) : null

  return (
    <SidePanel open={booking !== null} onClose={onClose}>
      {booking && cfg && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: cfg.color }} />
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ color: cfg.color, background: cfg.bg }}
              >
                {cfg.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Service + time */}
            <div>
              <p className="text-base font-semibold leading-tight">{booking.service_type}</p>
              <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">
                  {formatDate(new Date(booking.scheduled_at), 'long')} · {formatTime(booking.scheduled_at)}
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

            {/* Customer */}
            <div className="space-y-2">
              <p className="label-caps">Kund</p>
              {booking.customer ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{booking.customer.full_name}</span>
                  </div>
                  {booking.customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm tabular">{booking.customer.phone}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen kund kopplad</p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Car */}
            <div className="space-y-2">
              <p className="label-caps">Bil</p>
              {booking.car ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{booking.car.make} {booking.car.model}</span>
                  </div>
                  {booking.car.license_plate && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-3.5 text-center">#</span>
                      <span className="text-sm tabular font-medium tracking-widest uppercase">
                        {booking.car.license_plate}
                      </span>
                    </div>
                  )}
                  {booking.car.color && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-3.5 text-center">●</span>
                      <span className="text-sm text-muted-foreground">{booking.car.color}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen bil kopplad</p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Assigned employee */}
            <div className="space-y-2">
              <p className="label-caps">Ansvarig</p>
              {booking.assigned_worker ? (
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {booking.assigned_worker.full_name.charAt(0)}
                  </div>
                  <span className="text-sm">{booking.assigned_worker.full_name}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Ej tilldelad</p>
              )}
            </div>

            {booking.customer_notes && (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-2">
                  <p className="label-caps">Kundanteckning</p>
                  <div className="flex gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {booking.customer_notes}
                    </p>
                  </div>
                </div>
              </>
            )}

            {booking.service_notes && (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-2">
                  <p className="label-caps">Interna anteckningar</p>
                  <div className="flex gap-2">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {booking.service_notes}
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-border" />
            <div className="space-y-2">
              <p className="label-caps">SMS-bekräftelse</p>
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: booking.sms_confirmation_sent ? '#3DAB6A' : '#6B6870' }}
                />
                <span className="text-sm text-muted-foreground">
                  {booking.sms_confirmation_sent ? 'Skickad' : 'Ej skickad'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-4 border-t border-border space-y-2">
            <Link
              href={`/bookings/${booking.id}`}
              className="block w-full text-center text-sm font-medium py-2 rounded border border-border hover:bg-secondary transition-colors"
            >
              Öppna bokning
            </Link>
          </div>
        </>
      )}
    </SidePanel>
  )
}
