import { WorkersTable } from '@/components/workers/workers-table'

export default function WorkersPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Personal</h1>
        <p className="text-muted-foreground text-sm">Hantera ditt tvättteam</p>
      </div>
      <WorkersTable workers={[]} />
    </div>
  )
}
