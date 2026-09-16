/*
  Client-safe formatting shared by the real SMS send (lib/sms/46elks.ts) and the
  on-screen preview (admin/sms-templates), so what the admin sees is exactly
  what the customer gets.
*/

export const SMS_TZ = 'Europe/Stockholm'

// "måndag 9 juni"
export function formatSmsDate(d: Date): string {
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: SMS_TZ })
}

// "10:00"
export function formatSmsTime(d: Date): string {
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: SMS_TZ })
}

export interface TemplateVars {
  name: string
  service: string
  date: string
  time: string
}

export function interpolateTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/{name}/g,    vars.name)
    .replace(/{date}/g,    vars.date)
    .replace(/{time}/g,    vars.time)
    .replace(/{service}/g, vars.service)
}
