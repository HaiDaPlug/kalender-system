import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, isReviewer } from '@/lib/auth/session'
import { jsonError } from '@/lib/api'

const MAX_BYTES = 15 * 1024 * 1024

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif':  'gif',
}

function extensionFor(file: File): string {
  const byMime = EXT_BY_MIME[file.type]
  if (byMime) return byMime
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : 'jpg'
}

// POST /api/jobs/[id]/images  (multipart: file, type=before|after)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase, user, profile } = auth
  const { id: jobId } = await params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('Ogiltig uppladdning', 400)
  }

  const file = formData.get('file')
  const type = formData.get('type')

  if (!(file instanceof File) || (type !== 'before' && type !== 'after')) {
    return jsonError('file och type (before/after) krävs', 400)
  }
  if (!file.type.startsWith('image/')) return jsonError('Endast bilder kan laddas upp', 400)
  if (file.size === 0)                 return jsonError('Filen är tom', 400)
  if (file.size > MAX_BYTES)           return jsonError('Bilden är för stor (max 15 MB)', 413)

  const { data: job, error: jobErr } = await supabase
    .from('cleaning_jobs')
    .select('id, worker_id')
    .eq('id', jobId)
    .maybeSingle()

  if (jobErr) return jsonError(jobErr.message, 500)
  if (!job)   return jsonError('Jobbet hittades inte', 404)
  if (!isReviewer(profile.role) && job.worker_id !== profile.id) {
    return jsonError('Du kan bara ladda upp bilder till dina egna jobb', 403)
  }

  const bucket = type === 'before' ? 'car-before-images' : 'car-after-images'
  const storagePath = `${jobId}/${Date.now()}.${extensionFor(file)}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return jsonError(uploadError.message, 500)

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  const { data: imageRecord, error: dbError } = await supabase
    .from('job_images')
    .insert({
      job_id:          jobId,
      storage_path:    `${bucket}/${storagePath}`,
      public_url:      publicUrl,
      type,
      uploaded_by:     user.id,
      file_size_bytes: file.size,
    })
    .select()
    .single()

  if (dbError) {
    // Don't leave an orphaned object behind if the row could not be written.
    await supabase.storage.from(bucket).remove([storagePath])
    return jsonError(dbError.message, 500)
  }

  return NextResponse.json(imageRecord, { status: 201 })
}
