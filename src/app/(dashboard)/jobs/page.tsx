'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { JobsBoard } from '@/components/jobs/jobs-board'
import type { CleaningJob } from '@/types'

export default function JobsPage() {
  const [jobs, setJobs] = useState<CleaningJob[]>([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    if (res.ok) setJobs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { (async () => { await fetchJobs() })() }, [fetchJobs])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tvättjobb</h1>
        <p className="text-muted-foreground text-sm">Följ jobbstatus, bilder och anteckningar</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar jobb…</span>
        </div>
      ) : (
        <JobsBoard jobs={jobs} />
      )}
    </div>
  )
}
