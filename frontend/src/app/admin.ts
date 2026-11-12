// Admin console API: uses the existing /api/admin/** endpoints (ADMIN role only).
import { request, HttpError } from '../api'

export type Reversal = { reversalTransactionId: number; originalTransactionId: number; amount: number; status: string }
export type LogEntry = Reversal & { at: string }
export type Check = { name: string; passed: boolean; details: string; offenders: string[] | null }
export type Recon = { status: string; checkedAt: string; checks: Check[] }
const LOG = 'nexora_admin_log'
const ref = (id: number) => 'NX-' + String(id).padStart(6, '0')
export const refOf = ref

export const adminApi = {
  // The API has no "list reversals" endpoint, so reversals done from this browser are remembered locally.
  log(): LogEntry[] { try { return JSON.parse(localStorage.getItem(LOG) || '[]') } catch { return [] } },
  async reverse(input: string): Promise<LogEntry> {
    const m = input.trim().match(/^(?:NX-)?0*(\d+)$/i)
    if (!m) throw new HttpError(400, 'Enter a valid transaction ID, like NX-000123 or 123.')
    const { data } = await request<Reversal>('POST', `/api/admin/transactions/${m[1]}/reverse`, { auth: true })
    const entry = { ...data, at: new Date().toISOString() }
    try { localStorage.setItem(LOG, JSON.stringify([entry, ...adminApi.log()].slice(0, 50))) } catch {}
    return entry
  },
  async reconcile(): Promise<Recon> { return (await request<Recon>('GET', '/api/admin/reconciliation', { auth: true })).data }
}
