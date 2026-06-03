const GHL_BASE_URL = 'https://services.leadconnectorhq.com'
const GHL_API_VERSION = '2021-07-28'

export interface GHLRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  params?: Record<string, string>
}

async function ghlFetch<T>(
  path: string,
  options: GHLRequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, params } = options

  const url = new URL(`${GHL_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: GHL_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`GHL API error ${res.status}: ${error}`)
  }

  return res.json() as Promise<T>
}

// ── Calendars ──────────────────────────────────────────────────────────────

export interface GHLAppointment {
  id: string
  calendarId: string
  locationId: string
  contactId: string
  startTime: string
  endTime: string
  title: string
  status: string
  notes?: string
  assignedUserId?: string
}

export interface GHLCreateAppointmentPayload {
  calendarId: string
  locationId: string
  contactId: string
  startTime: string
  endTime: string
  title?: string
  notes?: string
  assignedUserId?: string
}

export const ghlCalendar = {
  getAppointment: (appointmentId: string) =>
    ghlFetch<{ appointment: GHLAppointment }>(`/calendars/events/appointments/${appointmentId}`),

  createAppointment: (payload: GHLCreateAppointmentPayload) =>
    ghlFetch<{ appointment: GHLAppointment }>('/calendars/events/appointments', {
      method: 'POST',
      body: payload,
    }),

  updateAppointment: (appointmentId: string, payload: Partial<GHLCreateAppointmentPayload>) =>
    ghlFetch<{ appointment: GHLAppointment }>(`/calendars/events/appointments/${appointmentId}`, {
      method: 'PUT',
      body: payload,
    }),

  deleteAppointment: (appointmentId: string) =>
    ghlFetch<void>(`/calendars/events/appointments/${appointmentId}`, { method: 'DELETE' }),

  getSlots: (calendarId: string, startDate: string, endDate: string, locationId: string) =>
    ghlFetch<{ slots: Record<string, { slots: string[] }> }>(
      `/calendars/${calendarId}/free-slots`,
      { params: { startDate, endDate, locationId } }
    ),
}

// ── Contacts ───────────────────────────────────────────────────────────────

export interface GHLContact {
  id: string
  locationId: string
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  address1?: string
  notes?: string
}

export interface GHLCreateContactPayload {
  locationId: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address1?: string
  notes?: string
}

export const ghlContacts = {
  getContact: (contactId: string) =>
    ghlFetch<{ contact: GHLContact }>(`/contacts/${contactId}`),

  createContact: (payload: GHLCreateContactPayload) =>
    ghlFetch<{ contact: GHLContact }>('/contacts/', { method: 'POST', body: payload }),

  updateContact: (contactId: string, payload: Partial<GHLCreateContactPayload>) =>
    ghlFetch<{ contact: GHLContact }>(`/contacts/${contactId}`, {
      method: 'PUT',
      body: payload,
    }),

  searchContacts: (locationId: string, query: string) =>
    ghlFetch<{ contacts: GHLContact[] }>('/contacts/', {
      params: { locationId, query },
    }),
}

// ── Conversations / SMS ────────────────────────────────────────────────────

export interface GHLSendMessagePayload {
  type: 'SMS' | 'Email' | 'WhatsApp'
  contactId: string
  locationId: string
  message: string
}

export interface GHLMessage {
  id: string
  conversationId: string
  contactId: string
  status: string
  body: string
  dateAdded: string
}

export const ghlConversations = {
  sendMessage: (payload: GHLSendMessagePayload) =>
    ghlFetch<{ message: GHLMessage }>('/conversations/messages', {
      method: 'POST',
      body: payload,
    }),

  getConversation: (conversationId: string) =>
    ghlFetch<{ conversation: { id: string; contactId: string; unreadCount: number } }>(
      `/conversations/${conversationId}`
    ),
}
