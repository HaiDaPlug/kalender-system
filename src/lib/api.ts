import { NextResponse, type NextRequest } from 'next/server'

// Small helpers shared by the route handlers so request parsing and error
// responses look the same everywhere.

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/*
  request.json() throws on a malformed body, which used to surface as an
  unhandled 500. Returns null when the body is missing or is not a JSON object.
*/
export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

/*
  Copies only the allowed keys from an untrusted body into a new object.
  Keys that are absent stay absent (so PATCH semantics are preserved).
*/
export function pickAllowed<T extends string>(
  body: Record<string, unknown>,
  allowed: readonly T[],
): Partial<Record<T, unknown>> {
  const out: Partial<Record<T, unknown>> = {}
  for (const key of allowed) {
    if (key in body) out[key] = body[key]
  }
  return out
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

export function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}
