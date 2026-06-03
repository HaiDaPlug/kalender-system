import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createRawClient()
  const { id: jobId } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as 'before' | 'after' | null

  if (!file || !type) {
    return NextResponse.json({ error: 'file and type are required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const bucket = type === 'before' ? 'car-before-images' : 'car-after-images'
  const storagePath = `${jobId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  const { data: imageRecord, error: dbError } = await supabase
    .from('job_images')
    .insert({
      job_id: jobId,
      storage_path: `${bucket}/${storagePath}`,
      public_url: publicUrl,
      type,
      uploaded_by: user.id,
      file_size_bytes: file.size,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json(imageRecord, { status: 201 })
}
