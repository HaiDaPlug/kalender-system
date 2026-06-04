export type GHLWebhookEvent =
  | 'AppointmentCreate'
  | 'AppointmentUpdate'
  | 'AppointmentDelete'
  | 'ContactCreate'
  | 'ContactUpdate'
  | 'InboundMessage'
  | 'OutboundMessage'

export interface GHLWebhookPayload {
  type: GHLWebhookEvent
  locationId: string
  // The webhook delivery ID — present on all event types.
  // Distinct from the appointment/contact entity ID.
  id?: string
  [key: string]: unknown
}

// GHL private-integration appointment webhook — entity fields are nested under `appointment`.
export interface GHLAppointmentData {
  id: string
  calendarId: string
  contactId: string
  startTime: string
  endTime: string
  appointmentStatus: string
  title?: string
  notes?: string
}

export interface GHLAppointmentWebhookPayload extends GHLWebhookPayload {
  type: 'AppointmentCreate' | 'AppointmentUpdate' | 'AppointmentDelete'
  appointment: GHLAppointmentData
}

export interface GHLContactWebhookPayload extends GHLWebhookPayload {
  type: 'ContactCreate' | 'ContactUpdate'
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

export function parseWebhookPayload(body: unknown): GHLWebhookPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid webhook payload')
  }
  return body as GHLWebhookPayload
}

export function isAppointmentEvent(
  payload: GHLWebhookPayload
): payload is GHLAppointmentWebhookPayload {
  return ['AppointmentCreate', 'AppointmentUpdate', 'AppointmentDelete'].includes(payload.type)
}

export function isContactEvent(
  payload: GHLWebhookPayload
): payload is GHLContactWebhookPayload {
  return ['ContactCreate', 'ContactUpdate'].includes(payload.type)
}
