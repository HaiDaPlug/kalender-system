import { JobsBoard } from '@/components/jobs/jobs-board'

export default function JobsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tvättjobb</h1>
        <p className="text-muted-foreground text-sm">Följ jobbstatus, bilder och anteckningar</p>
      </div>
      <JobsBoard jobs={[]} />
    </div>
  )
}
