import { CalendarView } from '@/components/calendar/calendar-view'

export default function CalendarPage() {
  return (
    <div className="space-y-5 h-full">
      <div>
        <h1 className="text-xl font-semibold">Kalender</h1>
        <p className="text-muted-foreground text-sm">Visa och hantera schemalagda jobb</p>
      </div>
      <CalendarView bookings={[]} />
    </div>
  )
}
