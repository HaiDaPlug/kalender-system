import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingApproved, sendBookingRejected } from '@/lib/email/resend'

// POST /api/bookings/approve
// Admin approves or rejects a pending booking.
// On approve: status → 'confirmed', email sent to the worker who submitted it.
// On reject:  status → 'cancelled', email sent with optional reason.
export async function POST(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user) {
    const { data: actor } = await sessionClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!['admin', 'manager'].includes((actor as { role: string } | null)?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await request.json() as {
    bookingId: string
    action: 'approved' | 'rejected'
    reason?: string
  }

  if (!body.bookingId || !['approved', 'rejected'].includes(body.action)) {
    return NextResponse.json({ error: 'bookingId and action required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch the booking + creator profile for the email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error: fetchError } = await (service as any)
    .from('bookings')
    .select('*, customer:customers(*), car:cars(*), creator:profiles!bookings_created_by_fkey(*)')
    .eq('id', body.bookingId)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const newStatus = body.action === 'approved' ? 'confirmed' : 'cancelled'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (service as any)
    .from('bookings')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', body.bookingId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Send email to the worker who submitted the booking (fire-and-forget)
  if (booking.creator?.email) {
    const emailData = {
      bookingId:    booking.id,
      customerName: booking.customer?.full_name ?? '—',
      carMake:      booking.car?.make ?? '—',
      carModel:     booking.car?.model ?? '—',
      licensePlate: booking.car?.license_plate,
      serviceType:  booking.service_type,
      scheduledAt:  booking.scheduled_at,
      workerName:   booking.creator.full_name,
      workerEmail:  booking.creator.email,
    }

    if (body.action === 'approved') {
      void sendBookingApproved(emailData)
    } else {
      void sendBookingRejected({ ...emailData, reason: body.reason })
    }
  }

  return NextResponse.json({ status: newStatus })
}
