'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { JobsBoard } from '@/components/jobs/jobs-board'
import { PageHeader } from '@/components/ui/page-header'
import type { CleaningJob } from '@/types'

export default function JobsPage() {
  const [jobs, setJobs] = useState<CleaningJob[]>([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    if (res.ok) {
      setJobs(await res.json())
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error('Kunde inte hämta jobb', { description: d.error ?? `${res.status} ${res.statusText}` })
    }
    setLoading(false)
  }, [])

  useEffect(() => { (async () => { await fetchJobs() })() }, [fetchJobs])

  const active = jobs.filter(j => j.status === 'in_progress' || j.status === 'needs_review').length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tvättjobb"
        subtitle={loading ? 'Laddar…' : `${jobs.length} jobb · ${active} pågående`}
      />
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
