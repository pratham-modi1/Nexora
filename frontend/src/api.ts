// ============================================================
//  Nexora ⇄ Aureus (Spring Boot) — shared HTTP + auth layer
//
//  Backend contract:
//    POST /api/auth/register  {email,password} -> 201 {userId,email,bankBalance,walletBalance}   (no token!)
//    POST /api/auth/login     {email,password} -> 200 {token,tokenType,expiresIn}
//    Everything else needs   Authorization: Bearer <jwt>
//  Errors: { error, message }  — or, for bean-validation failures, { fieldName: "message", ... }
//
//  VITE_DEMO=true  -> fake login + in-browser sample data (no backend needed)
//  VITE_DEMO=false -> talk to VITE_API_URL
// ============================================================
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080').replace(/\/+$/, '')
export const DEMO = import.meta.env.VITE_DEMO === 'true'
export const ENDPOINTS = { login: '/api/auth/login', register: '/api/auth/register' }
export const AFTER_AUTH_URL = '/app.html'            // where to go after a successful login/register
export const SKIP_INTRO_IF_LOGGED_IN = false     // true: logged-in users skip the intro and go straight to AFTER_AUTH_URL
const KEY = 'nexora_jwt', EMAIL_KEY = 'nexora_email'

export class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }

// ---------- session ----------
export const getToken = () => { try { return localStorage.getItem(KEY) } catch { return null } }
export const clearSession = () => { try { localStorage.removeItem(KEY) } catch {} }
export const currentEmail = () => { try { return localStorage.getItem(EMAIL_KEY) } catch { return null } }
function claims(): Record<string, any> | null {
  const t = getToken(); if (!t || t === 'demo') return null
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return null }
}
export const currentRole = (): string => (claims()?.role as string | undefined) ?? 'USER'
export const msUntilExpiry = (): number | null => { const p = claims(); return p?.exp ? p.exp * 1000 - Date.now() : null }
export function hasValidToken(): boolean {
  const t = getToken(); if (!t) return false; if (t === 'demo') return DEMO
  const p = claims(); return !!p && (!p.exp || p.exp * 1000 > Date.now())
}
function saveSession(token: string, email: string) {
  try { localStorage.setItem(KEY, token); localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase()) } catch {}
}

// ---------- http ----------
function messageOf(data: any): string {
  if (!data || typeof data !== 'object') return ''
  if (typeof data.message === 'string') return data.message
  return Object.values(data).filter((v): v is string => typeof v === 'string').join(' ')   // validation errors: {field: msg}
}
type Opts = { body?: object; headers?: Record<string, string>; auth?: boolean }
export async function request<T = any>(method: string, path: string, o: Opts = {}): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { Accept: 'application/json', ...o.headers }
  if (o.body !== undefined) headers['Content-Type'] = 'application/json'
  if (o.auth) { const t = getToken(); if (t) headers.Authorization = `Bearer ${t}` }
  let r: Response
  try { r = await fetch(BASE + path, { method, headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }) }
  catch { throw new HttpError(0, "Can't reach the server. Please try again.") }
  const data = await r.json().catch(() => ({}))
  if (r.status === 401 && o.auth) {                         // token expired / revoked -> back to login
    clearSession(); setTimeout(() => location.replace('/'), 1200)
    throw new HttpError(401, 'Your session has expired. Please log in again.')
  }
  if (!r.ok) throw new HttpError(r.status, messageOf(data) || (r.status === 403 ? "You don't have access to that." : 'Something went wrong.'))
  return { status: r.status, data: data as T }
}

// ---------- auth ----------
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
export async function login(email: string, password: string): Promise<void> {
  if (DEMO) { await sleep(700); return saveSession('demo', email) }
  const { data } = await request<{ token?: string }>('POST', ENDPOINTS.login, { body: { email: email.trim(), password } })
  if (!data.token) throw new HttpError(500, 'The server did not return a login token.')
  saveSession(data.token, email)
}
export async function register(email: string, password: string): Promise<void> {
  if (DEMO) { await sleep(700); return saveSession('demo', email) }
  await request('POST', ENDPOINTS.register, { body: { email: email.trim(), password } })
  await login(email, password)                              // register returns no token, so sign in right after
}
export const onAuthSuccess = () => { window.location.href = AFTER_AUTH_URL }
