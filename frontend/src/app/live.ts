// Live data layer: the same `api` surface as mock.ts, backed by the Aureus Spring Boot API.
import { request, HttpError, currentEmail, currentRole } from '../api'
import type { api as MockApi, view as MockView } from './mock'

type Mock = typeof MockApi
type TxV = ReturnType<typeof MockView>
type Status = Parameters<Mock['setGoal']>[1]

// Keep in sync with application.properties (aureus.limits.*). The server is the source of truth; these only feed the UI hint text.
export const LIMITS = { perTx: 50000, walletMax: 100000 }

// ---------- backend shapes ----------
type BTx = { transactionId: number; type: TxV['type']; direction: string; amount: number; status: TxV['status']; counterparty: string | null; createdAt: string }
type BPage = { content: BTx[]; page: number; size: number; totalElements: number; totalPages: number }
type BMoney = { transactionId: number; type: TxV['type']; amount: number; status: TxV['status']; bankBalance: number; walletBalance: number }
type BSend = { transactionId: number; type: TxV['type']; amount: number; status: TxV['status']; recipientEmail: string; walletBalance: number }
type BGoal = { goalId: number; goalName: string; targetAmount: number; deadline: string; status: Status; walletBalance: number; remainingAmount: number; monthsRemaining: number; suggestedMonthly: number; progressPercent: number; achieved: boolean }

// ---------- mapping ----------
const ref = (id: number) => 'NX-' + String(id).padStart(6, '0')
const iso = (s: string) => s.replace(/(\.\d{3})\d+/, '$1')           // Safari chokes on >3 fractional digits
const DIR: Record<string, TxV['dir']> = {
  OPENING_BALANCE: 'RECEIVED', ADDED_TO_WALLET: 'INTERNAL', TO_BANK: 'INTERNAL',
  SENT: 'SENT', RECEIVED: 'RECEIVED', REVERSAL_DEBIT: 'SENT', REVERSAL_CREDIT: 'RECEIVED'
}
function view(b: BTx): TxV {
  const other = b.counterparty ? (b.counterparty === 'Aureus' ? 'Nexora' : b.counterparty) : ''
  const handle = other.split('@')[0], cpl = other ? `${handle} · Wallet` : 'Nexora'
  const [from, to] = ({
    OPENING_BALANCE: ['Nexora System', 'Your Bank'], ADDED_TO_WALLET: ['Your Bank', 'Your Wallet'], TO_BANK: ['Your Wallet', 'Your Bank'],
    SENT: ['Your Wallet', cpl], RECEIVED: [cpl, 'Your Wallet'], REVERSAL_DEBIT: ['Your account', cpl], REVERSAL_CREDIT: [cpl, 'Your account']
  } as Record<string, [string, string]>)[b.direction] ?? ['—', '—']
  const title = ({
    OPENING_BALANCE: 'Opening balance', ADDED_TO_WALLET: 'Added to wallet', TO_BANK: 'Moved to bank',
    SENT: `Sent to ${other || 'Nexora'}`, RECEIVED: `Received from ${other || 'Nexora'}`,
    REVERSAL_DEBIT: `Reversal debit${other ? ' · ' + other : ''}`, REVERSAL_CREDIT: `Reversal credit${other ? ' · ' + other : ''}`
  } as Record<string, string>)[b.direction] ?? b.type
  const sub = ({ OPENING_BALANCE: 'Welcome credit', ADDED_TO_WALLET: 'Bank → Wallet', TO_BANK: 'Wallet → Bank', SENT: 'Wallet transfer', RECEIVED: 'Wallet transfer' } as Record<string, string>)[b.direction] ?? 'Correction entry'
  return { who: handle || 'you', id: b.transactionId, ref: ref(b.transactionId), type: b.type, dir: DIR[b.direction] ?? 'INTERNAL', title, sub, amount: b.amount, at: iso(b.createdAt), status: b.status, from, to, key: '', orig: null }
}
// Money endpoints return balances rather than a TransactionView, so build the receipt locally.
const receipt = (r: { transactionId: number; type: TxV['type']; amount: number; status: TxV['status'] }, dir: TxV['dir'], title: string, sub: string, from: string, to: string): TxV =>
  ({ who: 'you', id: r.transactionId, ref: ref(r.transactionId), type: r.type, dir, title, sub, amount: r.amount, at: new Date().toISOString(), status: r.status, from, to, key: '', orig: null })

const positive = (n: number) => { if (!(n > 0)) throw new HttpError(400, 'Enter an amount greater than zero.') }
const idem = (key: string) => ({ 'Idempotency-Key': key })
const PAGE = 50                                                       // backend caps page size at 50

function goalView(g: BGoal) {
  const today = new Date().toISOString().slice(0, 10)
  const status: Status = g.achieved && g.status === 'ACTIVE' ? 'COMPLETED' : g.status   // backend never auto-completes; show it as reached
  return {
    id: g.goalId, name: g.goalName, target: g.targetAmount, deadline: g.deadline, status,
    saved: Math.min(g.walletBalance, g.targetAmount), remaining: g.remainingAmount, monthsLeft: g.monthsRemaining,
    overdue: g.deadline < today, monthly: g.suggestedMonthly, progress: Math.min(1, Math.max(0, g.progressPercent / 100))
  }
}

export const api: Mock = {
  async me() { return { email: currentEmail() ?? 'your account', role: currentRole() } },   // backend has no /me; email is saved at login, role comes from the JWT

  async accounts() {
    const { data } = await request<{ bankBalance: number; walletBalance: number }>('GET', '/api/accounts/me', { auth: true })
    return { bank: { id: 0, balance: data.bankBalance }, wallet: { id: 0, balance: data.walletBalance } }
  },

  async addMoney(amount, key) {
    positive(amount)
    const { status, data } = await request<BMoney>('POST', '/api/wallet/add-money', { auth: true, body: { amount }, headers: idem(key) })
    return { tx: receipt(data, 'INTERNAL', 'Added to wallet', 'Bank → Wallet', 'Your Bank', 'Your Wallet'), replayed: status === 200 }
  },

  async toBank(amount, key) {
    positive(amount)
    const { status, data } = await request<BMoney>('POST', '/api/wallet/transfer-to-bank', { auth: true, body: { amount }, headers: idem(key) })
    return { tx: receipt(data, 'INTERNAL', 'Moved to bank', 'Wallet → Bank', 'Your Wallet', 'Your Bank'), replayed: status === 200 }
  },

  async send(to, amount, key) {
    positive(amount)
    const { status, data } = await request<BSend>('POST', '/api/wallet/send', { auth: true, body: { recipientEmail: to.trim(), amount }, headers: idem(key) })
    return { tx: receipt(data, 'SENT', `Sent to ${data.recipientEmail}`, 'Wallet transfer', 'Your Wallet', `${data.recipientEmail.split('@')[0]} · Wallet`), replayed: status === 200 }
  },

  // The UI asks for pages of any size (e.g. 1000 for charts); the backend serves max 50 per call, so stitch pages together.
  async list(q) {
    const offset = q.page * q.size, end = offset + q.size
    const get = (p: number) => {
      const qs = new URLSearchParams({ page: String(p), size: String(PAGE) })
      if (q.type) qs.set('type', q.type); if (q.from) qs.set('from', q.from); if (q.to) qs.set('to', q.to)
      return request<BPage>('GET', `/api/transactions?${qs}`, { auth: true }).then(r => r.data)
    }
    let p = Math.floor(offset / PAGE), total = 0, pages = 1; const all: BTx[] = []
    do { const r = await get(p); total = r.totalElements; pages = r.totalPages; all.push(...r.content); p++ } while (p < pages && p * PAGE < end)
    let items = all.slice(offset - Math.floor(offset / PAGE) * PAGE).slice(0, q.size).map(view)
    if (q.dir) items = items.filter(x => x.dir === q.dir)             // no server-side direction filter; applied to the fetched window
    return { total, items }
  },

  async detail(id) {
    const { data } = await request<BTx>('GET', `/api/transactions/${id}`, { auth: true })
    const v = view(data)
    // The API doesn't expose the ledger table, but every posted transaction is exactly one DEBIT (sender) + one CREDIT (receiver), so derive them.
    const ledger: { kind: 'DEBIT' | 'CREDIT'; account: string; amount: number }[] = v.status === 'COMPLETED'
      ? [{ kind: 'DEBIT', account: v.from, amount: v.amount }, { kind: 'CREDIT', account: v.to, amount: v.amount }] : []
    return { ...v, ledger, balanced: false }   // balanced:false => UI says "derived", not "verified" (the admin reconciliation does the real audit)
  },

  async goals() {
    const { data } = await request<BGoal[]>('GET', '/api/savings', { auth: true })
    return data.map(goalView)
  },

  async createGoal(name, target, deadline) {
    if (!name.trim()) throw new HttpError(400, 'Give the goal a name.')
    if (!(target > 0)) throw new HttpError(400, 'Target must be above zero.')
    if (!deadline) throw new HttpError(400, 'Pick a deadline in the future.')
    await request('POST', '/api/savings', { auth: true, body: { goalName: name.trim(), targetAmount: target, deadline } })
  },

  async setGoal(id, status) { await request('PATCH', `/api/savings/${id}/status`, { auth: true, body: { status } }) }
}
