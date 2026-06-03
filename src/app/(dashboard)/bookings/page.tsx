import { BookingsTable } from '@/components/booking/bookings-table'

export default function BookingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Bokningar</h1>
        <p className="text-muted-foreground text-sm">Hantera alla biltvättbokningar</p>
      </div>
      <BookingsTable bookings={[]} />
    </div>
  )
}
