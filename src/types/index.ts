export type UserRole = 'admin' | 'manager' | 'worker'

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export type CleaningJobStatus = 'not_started' | 'in_progress' | 'completed' | 'needs_review'

export type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed'

export interface Profile {
  id: string
  email: string
  full_name: string
  phone?: string
  role: UserRole
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  full_name: string
  email?: string
  phone: string
  address?: string
  notes?: string
  highlevel_contact_id?: string
  created_at: string
  updated_at: string
}

export interface Car {
  id: string
  customer_id: string
  make: string
  model: string
  year?: number
  color?: string
  license_plate?: string
  vin?: string
  notes?: string
  created_at: string
  updated_at: string
  customer?: Customer
}

export interface Booking {
  id: string
  customer_id: string
  car_id: string
  assigned_worker_id?: string
  status: BookingStatus
  scheduled_at: string
  estimated_duration_minutes: number
  service_type: string
  service_notes?: string
  customer_notes?: string
  location_address?: string
  total_price?: number
  highlevel_appointment_id?: string
  highlevel_calendar_id?: string
  sms_confirmation_sent: boolean
  created_at: string
  updated_at: string
  customer?: Customer
  car?: Car
  assigned_worker?: Profile
  cleaning_job?: CleaningJob
}

export interface CleaningJob {
  id: string
  booking_id: string
  worker_id: string
  status: CleaningJobStatus
  started_at?: string
  completed_at?: string
  worker_notes?: string
  admin_notes?: string
  before_images: ImageRecord[]
  after_images: ImageRecord[]
  created_at: string
  updated_at: string
  booking?: Booking
  worker?: Profile
}

export interface ImageRecord {
  id: string
  job_id: string
  storage_path: string
  public_url: string
  type: 'before' | 'after'
  uploaded_by: string
  file_size_bytes?: number
  created_at: string
}

export interface SmsLog {
  id: string
  booking_id: string
  customer_id: string
  phone_number: string
  message_body: string
  status: SmsStatus
  highlevel_message_id?: string
  sent_at?: string
  error_message?: string
  created_at: string
}

export interface HighLevelSyncLog {
  id: string
  entity_type: 'booking' | 'customer' | 'contact'
  entity_id: string
  highlevel_id?: string
  action: 'create' | 'update' | 'delete' | 'webhook_received'
  payload?: Record<string, unknown>
  success: boolean
  error_message?: string
  created_at: string
}

export interface CalendarEvent {
  id: string
  booking_id: string
  title: string
  start: string
  end: string
  status: BookingStatus
  worker_name?: string
  customer_name?: string
  service_type?: string
  color?: string
}
