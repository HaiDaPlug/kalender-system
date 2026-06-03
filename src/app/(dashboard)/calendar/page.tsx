import { CalendarView } from '@/components/calendar/calendar-view'

export default function CalendarPage() {
  return (
    <div className="flex flex-col h-full">
      <CalendarView bookings={[]} />
    </div>
  )
}
