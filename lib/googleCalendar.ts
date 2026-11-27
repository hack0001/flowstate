import { getImpersonatedAccessToken } from '@/lib/googleDrive'

// Google Calendar sync (server only). Uses the SAME service account +
// domain-wide delegation as the Script Editor / Search Console, impersonating
// GOOGLE_WORKSPACE_IMPERSONATE_EMAIL, so "primary" is Tom's own calendar.
//
// ONE-TIME SETUP: Google Admin console -> Security -> API controls ->
// Domain-wide delegation -> edit the existing client and ADD this scope:
//   https://www.googleapis.com/auth/calendar
// (and make sure the Google Calendar API is enabled in the Cloud project).

const SCOPE = 'https://www.googleapis.com/auth/calendar'
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary'
export const CAL_TZ = 'Europe/London'

export type GcalEvent = {
  id: string; title: string; date: string
  startMin: number | null; endMin: number | null   // null for all-day
  allDay: boolean; link: string | null
}

async function gfetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getImpersonatedAccessToken(!retry, SCOPE)
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  // A token minted just before the scope was authorised can be stale: refresh once.
  if ((res.status === 401 || res.status === 403) && retry) return gfetch(path, init, false)
  return res
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text()
  if (res.status === 403 || res.status === 401 || /unauthorized_client|invalid_grant/.test(text)) {
    throw new Error(`Google Calendar isn't authorised yet (${what}). Add the scope ${SCOPE} to the domain-wide delegation entry in Google Admin and enable the Google Calendar API. Details: ${text.slice(0, 200)}`)
  }
  throw new Error(`Google Calendar ${what} failed (${res.status}): ${text.slice(0, 200)}`)
}

const mins = (hhmm: string) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10)

/** Events between two YYYY-MM-DD dates (inclusive), excluding ones FlowState itself pushed. */
export async function listEvents(from: string, to: string): Promise<GcalEvent[]> {
  const qs = new URLSearchParams({
    singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: CAL_TZ,
    timeMin: new Date(from + 'T00:00:00Z').toISOString(),
    timeMax: new Date(new Date(to + 'T00:00:00Z').getTime() + 2 * 86400000).toISOString(),
  })
  const res = await gfetch('/events?' + qs.toString())
  if (!res.ok) await fail(res, 'list')
  const data = await res.json() as { items?: any[] }
  const out: GcalEvent[] = []
  for (const e of data.items ?? []) {
    if (e.status === 'cancelled') continue
    if (e.extendedProperties?.private?.flowstate === '1') continue
    const title = e.summary ?? '(no title)'
    if (e.start?.date) {
      out.push({ id: e.id, title, date: e.start.date, startMin: null, endMin: null, allDay: true, link: e.htmlLink ?? null })
    } else if (e.start?.dateTime) {
      const sd: string = e.start.dateTime, ed: string = e.end?.dateTime ?? sd
      const date = sd.slice(0, 10)
      if (date < from || date > to) continue
      const startMin = mins(sd.slice(11, 16))
      const endMin = ed.slice(0, 10) !== date ? 24 * 60 : Math.max(startMin + 15, mins(ed.slice(11, 16)))
      out.push({ id: e.id, title, date, startMin, endMin, allDay: false, link: e.htmlLink ?? null })
    }
  }
  return out
}

type PushTask = { id: string; title: string; due_date: string | null; start_time: string | null; duration_min: number | null; google_event_id: string | null }

/** Create or update the Google event for a timed task. Returns the event id, or null if the task has no time. */
export async function upsertTaskEvent(t: PushTask): Promise<string | null> {
  if (!t.due_date || !t.start_time) return null
  const startMin = mins(t.start_time)
  const endMin = Math.min(startMin + (t.duration_min ?? 30), 24 * 60 - 1)
  const hhmm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') + ':00'
  const body = {
    summary: t.title,
    start: { dateTime: `${t.due_date}T${hhmm(startMin)}`, timeZone: CAL_TZ },
    end: { dateTime: `${t.due_date}T${hhmm(endMin)}`, timeZone: CAL_TZ },
    description: 'Scheduled from FlowState',
    extendedProperties: { private: { flowstate: '1', taskId: t.id } },
  }
  if (t.google_event_id) {
    const res = await gfetch('/events/' + encodeURIComponent(t.google_event_id), { method: 'PATCH', body: JSON.stringify(body) })
    if (res.ok) return t.google_event_id
    if (res.status !== 404 && res.status !== 410) await fail(res, 'update')
  }
  const res = await gfetch('/events', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) await fail(res, 'create')
  return (await res.json()).id as string
}

export async function deleteEvent(eventId: string): Promise<void> {
  const res = await gfetch('/events/' + encodeURIComponent(eventId), { method: 'DELETE' })
  if (!res.ok && res.status !== 404 && res.status !== 410) await fail(res, 'delete')
}
