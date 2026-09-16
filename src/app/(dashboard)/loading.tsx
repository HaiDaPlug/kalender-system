// Streams instantly on navigation while the page's server work (session +
// queries) is still running, so a click feels immediate instead of frozen.
export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-fade-in" aria-busy="true" aria-label="Laddar">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="skeleton h-8 w-28" />
      </div>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="skeleton h-72 xl:col-span-3" />
        <div className="skeleton h-72 xl:col-span-2" />
      </div>
    </div>
  )
}
