// Auto-generate the real version with:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
// This stub satisfies TypeScript until you run the generator.

type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          role: 'admin' | 'manager' | 'worker'
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          phone?: string | null
          role?: 'admin' | 'manager' | 'worker'
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      customers: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string
          address: string | null
          notes: string | null
          highlevel_contact_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone: string
          address?: string | null
          notes?: string | null
          highlevel_contact_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      cars: {
        Row: {
          id: string
          customer_id: string
          make: string
          model: string
          year: number | null
          color: string | null
          license_plate: string | null
          vin: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          make: string
          model: string
          year?: number | null
          color?: string | null
          license_plate?: string | null
          vin?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['cars']['Insert']>
      }
      bookings: {
        Row: {
          id: string
          customer_id: string
          car_id: string
          assigned_worker_id: string | null
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at: string
          estimated_duration_minutes: number
          service_type: string
          service_notes: string | null
          customer_notes: string | null
          location_address: string | null
          total_price: number | null
          highlevel_appointment_id: string | null
          highlevel_calendar_id: string | null
          sms_confirmation_sent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          car_id: string
          assigned_worker_id?: string | null
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at: string
          estimated_duration_minutes?: number
          service_type: string
          service_notes?: string | null
          customer_notes?: string | null
          location_address?: string | null
          total_price?: number | null
          highlevel_appointment_id?: string | null
          highlevel_calendar_id?: string | null
          sms_confirmation_sent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>
      }
      cleaning_jobs: {
        Row: {
          id: string
          booking_id: string
          worker_id: string
          status: 'not_started' | 'in_progress' | 'completed' | 'needs_review'
          started_at: string | null
          completed_at: string | null
          worker_notes: string | null
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          worker_id: string
          status?: 'not_started' | 'in_progress' | 'completed' | 'needs_review'
          started_at?: string | null
          completed_at?: string | null
          worker_notes?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['cleaning_jobs']['Insert']>
      }
      job_images: {
        Row: {
          id: string
          job_id: string
          storage_path: string
          public_url: string
          type: 'before' | 'after'
          uploaded_by: string
          file_size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          storage_path: string
          public_url: string
          type: 'before' | 'after'
          uploaded_by: string
          file_size_bytes?: number | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['job_images']['Insert']>
      }
      sms_logs: {
        Row: {
          id: string
          booking_id: string | null
          customer_id: string
          phone_number: string
          message_body: string
          status: 'pending' | 'sent' | 'delivered' | 'failed'
          highlevel_message_id: string | null
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          customer_id: string
          phone_number: string
          message_body: string
          status?: 'pending' | 'sent' | 'delivered' | 'failed'
          highlevel_message_id?: string | null
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['sms_logs']['Insert']>
      }
      highlevel_sync_logs: {
        Row: {
          id: string
          entity_type: 'booking' | 'customer' | 'contact'
          entity_id: string
          highlevel_id: string | null
          action: 'create' | 'update' | 'delete' | 'webhook_received'
          payload: Json | null
          success: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: 'booking' | 'customer' | 'contact'
          entity_id: string
          highlevel_id?: string | null
          action: 'create' | 'update' | 'delete' | 'webhook_received'
          payload?: Json | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['highlevel_sync_logs']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
