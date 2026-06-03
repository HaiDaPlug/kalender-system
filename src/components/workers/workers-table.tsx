import type { Profile } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administratör',
  manager: 'Chef',
  worker: 'Tekniker',
}

export function WorkersTable({ workers }: { workers: Profile[] }) {
  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="grid border-b border-border px-5 py-2.5" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
        {['Namn', 'E-post', 'Telefon', 'Roll'].map(h => (
          <span key={h} className="label-caps">{h}</span>
        ))}
      </div>

      {workers.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="text-sm text-muted-foreground">Ingen personal hittades</p>
        </div>
      ) : (
        <ul>
          {workers.map((w, i) => (
            <li
              key={w.id}
              className="grid border-b border-border last:border-0 px-5 py-3 items-center hover:bg-secondary/40 transition-colors cursor-default animate-fade-up"
              style={{
                gridTemplateColumns: '1fr 1fr 1fr auto',
                animationDelay: `${i * 30}ms`,
              }}
            >
              <div className="flex items-center gap-2.5 pr-4">
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                  {w.full_name?.charAt(0) ?? '?'}
                </div>
                <span className="text-sm font-medium text-foreground truncate">{w.full_name}</span>
              </div>
              <span className="text-sm text-muted-foreground truncate pr-4">{w.email}</span>
              <span className="text-sm text-muted-foreground tabular pr-4">{w.phone ?? '—'}</span>
              <span className="label-caps px-2 py-0.5 rounded bg-secondary">
                {ROLE_LABELS[w.role] ?? w.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
