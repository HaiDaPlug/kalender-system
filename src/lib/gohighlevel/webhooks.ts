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
  id: string
  [key: string]: unknown
}

export interface GHLAppointmentWebhookPayload extends GHLWebhookPayload {
  type: 'AppointmentCreate' | 'AppointmentUpdate' | 'AppointmentDelete'
  calendarId: string
  contactId: string
  startTime: string
  endTime: string
  status: string
  title?: string
  notes?: string
}

export interface GHLContactWebhookPayload extends GHLWebhookPayload {
  type: 'ContactCreate' | 'ContactUpdate'
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
