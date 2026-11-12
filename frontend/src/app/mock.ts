// Sample data layer shaped like the Nexora schema (User, Account, Transaction, LedgerEntry, Savings).
// Swap `api` in api.ts for real fetch calls later; the UI only talks to that interface.
export type TxType = 'ADD_MONEY' | 'TRANSFER' | 'WITHDRAWAL' | 'REVERSAL' | 'OPENING_BALANCE'
type Acc = { id: number; user: number; type: 'BANK' | 'WALLET' | 'SYSTEM'; bal: number }
type Tx = { id: number; from: number; to: number; amt: number; type: TxType; at: string; status: 'COMPLETED' | 'FAILED' | 'PENDING'; key: string; orig: number | null }
type Led = { id: number; tx: number; acc: number; kind: 'DEBIT' | 'CREDIT'; amt: number }
type Goal = { id: number; name: string; target: number; deadline: string; status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED' }
type S = { users: Record<number, string>; accs: Acc[]; txs: Tx[]; led: Led[]; goals: Goal[]; idem: Record<string, { sig: string; tx: number }> }
export class ApiError extends Error { constructor(public status: number, m: string) { super(m) } }
export const LIMITS = { perTx: 25000, walletMax: 100000 }
const KEY = 'nexora_demo_v2', ME = 1, SYS = 1, MYB = 2, MYW = 3
let S: S, dropNext = false
export const demo = { dropNextResponse() { dropNext = true }, reset() { localStorage.removeItem(KEY); init() } }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch {} }
const acc = (id: number) => S.accs.find(a => a.id === id)!
const r2 = (n: number) => Math.round(n * 100) / 100

function post(type: TxType, from: number, to: number, amt: number, key: string, at = new Date().toISOString()) {
  const f = acc(from), t = acc(to)
  if (f.type !== 'SYSTEM' && f.bal < amt) throw new ApiError(422, 'Insufficient funds.')
  if (t.type === 'WALLET' && t.bal + amt > LIMITS.walletMax) throw new ApiError(422, `Wallet limit of ₹${LIMITS.walletMax.toLocaleString('en-IN')} would be exceeded.`)
  f.bal = r2(f.bal - amt); t.bal = r2(t.bal + amt)
  const tx: Tx = { id: S.txs.length + 1, from, to, amt, type, at, status: 'COMPLETED', key, orig: null }
  S.txs.push(tx); S.led.push({ id: S.led.length + 1, tx: tx.id, acc: from, kind: 'DEBIT', amt }, { id: S.led.length + 2, tx: tx.id, acc: to, kind: 'CREDIT', amt })
  return tx
}
function init() {
  try { const raw = localStorage.getItem(KEY); if (raw) { S = JSON.parse(raw); return } } catch {}
  S = { users: { 1: 'you', 2: 'rahul@nexora.demo', 3: 'priya@nexora.demo', 4: 'aman@nexora.demo' }, accs: [{ id: 1, user: 9, type: 'SYSTEM', bal: 99999999.99 }], txs: [], led: [], goals: [], idem: {} }
  ;[1, 2, 3, 4].forEach(u => { S.accs.push({ id: u * 2, user: u, type: 'BANK', bal: 0 }, { id: u * 2 + 1, user: u, type: 'WALLET', bal: 0 }) })
  const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString(); let k = 0; const K = () => 'seed-' + ++k
  ;[2, 3, 4].forEach(u => { post('OPENING_BALANCE', SYS, u * 2, 5000, K(), d(30)); post('ADD_MONEY', u * 2, u * 2 + 1, 3000, K(), d(29)) })
  post('OPENING_BALANCE', SYS, MYB, 5000, K(), d(10)); post('ADD_MONEY', MYB, MYW, 3000, K(), d(9)); post('TRANSFER', MYW, 5, 600, K(), d(8)); post('TRANSFER', MYW, 9, 350, K(), d(7))
  post('TRANSFER', 5, MYW, 1200, K(), d(6)); post('TRANSFER', MYW, 7, 450, K(), d(4)); post('WITHDRAWAL', MYW, MYB, 500, K(), d(3)); post('ADD_MONEY', MYB, MYW, 1000, K(), d(2))
  const m = post('TRANSFER', 9, MYW, 300, K(), d(1)); const rv = post('REVERSAL', MYW, 9, 300, K(), d(1)); rv.orig = m.id
  const mo = (n: number) => new Date(Date.now() + n * 30.4 * 864e5).toISOString().slice(0, 10)
  S.goals = [{ id: 1, name: 'Laptop fund', target: 60000, deadline: mo(5), status: 'ACTIVE' }, { id: 2, name: 'Goa trip', target: 15000, deadline: mo(3), status: 'ACTIVE' }, { id: 3, name: 'Headphones', target: 6000, deadline: mo(1), status: 'ACTIVE' }]
  save()
}
if (import.meta.env.VITE_DEMO === 'true') init()
const wait = () => new Promise(r => setTimeout(r, 380))
const mine = (id: number) => acc(id).user === ME
const label = (id: number) => { const a = acc(id); return a.type === 'SYSTEM' ? 'Nexora System' : a.user === ME ? `Your ${a.type === 'BANK' ? 'Bank' : 'Wallet'}` : `${S.users[a.user].split('@')[0]} · Wallet` }
const ref = (id: number) => 'NX-' + String(id).padStart(6, '0')
export function view(t: Tx) {
  const sm = mine(t.from), rm = mine(t.to), dir = sm && rm ? 'INTERNAL' : sm ? 'SENT' : 'RECEIVED'
  const other = S.users[acc(dir === 'SENT' ? t.to : t.from).user] ?? 'Nexora', who = other === 'you' ? 'You' : other
  const title = { OPENING_BALANCE: 'Opening balance', ADD_MONEY: 'Added to wallet', WITHDRAWAL: 'Moved to bank', TRANSFER: dir === 'SENT' ? `Sent to ${who}` : `Received from ${who}`, REVERSAL: `Reversal of ${t.orig ? ref(t.orig) : ''}` }[t.type]
  const sub = { OPENING_BALANCE: 'Welcome credit', ADD_MONEY: 'Bank → Wallet', WITHDRAWAL: 'Wallet → Bank', TRANSFER: dir === 'SENT' ? 'Wallet transfer' : 'Wallet transfer', REVERSAL: 'Correction entry' }[t.type]
  return { who: who.split('@')[0], id: t.id, ref: ref(t.id), type: t.type, dir, title, sub, amount: t.amt, at: t.at, status: t.status, from: label(t.from), to: label(t.to), key: t.key, orig: t.orig ? ref(t.orig) : null }
}
function idem<T>(key: string, sig: string, fn: () => Tx) {
  const k = `U${ME}-${key}`, hit = S.idem[k]
  if (hit) { if (hit.sig !== sig) throw new ApiError(409, 'This request key was already used with different details.'); return { tx: view(S.txs[hit.tx - 1]), replayed: true } }
  const tx = fn(); S.idem[k] = { sig, tx: tx.id }; save(); return { tx: view(tx), replayed: false }
}
async function run(key: string, sig: string, fn: () => Tx) {
  await wait(); const out = idem(key, sig, fn)
  if (dropNext) { dropNext = false; throw new Error('Network dropped before the response arrived. Tap again to retry safely.') }
  return out
}
function check(amt: number) { if (!(amt > 0)) throw new ApiError(400, 'Enter an amount greater than zero.'); if (amt > LIMITS.perTx) throw new ApiError(422, `Limit per transaction is ₹${LIMITS.perTx.toLocaleString('en-IN')}.`) }
const goalView = (g: Goal) => {
  const w = acc(MYW).bal, days = (new Date(g.deadline).getTime() - Date.now()) / 864e5, months = Math.max(1, Math.round(days / 30.4)), rem = Math.max(0, r2(g.target - w))
  return { id: g.id, name: g.name, target: g.target, deadline: g.deadline, status: g.status, saved: Math.min(w, g.target), remaining: rem, monthsLeft: months, overdue: days < 0, monthly: Math.ceil((rem / months) * 100) / 100, progress: Math.min(1, w / g.target) }
}
export const api = {
  async me() { return { email: localStorage.getItem('nexora_email') || 'you@nexora.demo', role: 'USER' } },
  async accounts() { await wait(); return { bank: { id: MYB, balance: acc(MYB).bal }, wallet: { id: MYW, balance: acc(MYW).bal } } },
  addMoney: (amount: number, key: string) => (check(amount), run(key, `ADD|${amount}`, () => post('ADD_MONEY', MYB, MYW, amount, key))),
  toBank: (amount: number, key: string) => (check(amount), run(key, `WD|${amount}`, () => post('WITHDRAWAL', MYW, MYB, amount, key))),
  send(to: string, amount: number, key: string) {
    check(amount); const uid = Object.keys(S.users).map(Number).find(u => S.users[u] === to.trim().toLowerCase() && u !== ME)
    if (to.trim().toLowerCase() === (localStorage.getItem('nexora_email') || '').toLowerCase()) throw new ApiError(422, 'You cannot send money to yourself.')
    if (!uid) throw new ApiError(404, 'No Nexora user with that email. Try rahul@nexora.demo.')
    return run(key, `TR|${uid}|${amount}`, () => post('TRANSFER', MYW, uid * 2 + 1, amount, key))
  },
  async list(q: { dir?: string; type?: string; from?: string; to?: string; page: number; size: number }) {
    await wait()
    let v = S.txs.filter(t => mine(t.from) || mine(t.to)).map(view).reverse()
    if (q.dir) v = v.filter(x => x.dir === q.dir); if (q.type) v = v.filter(x => x.type === q.type)
    if (q.from) v = v.filter(x => x.at.slice(0, 10) >= q.from!); if (q.to) v = v.filter(x => x.at.slice(0, 10) <= q.to!)
    return { total: v.length, items: v.slice(q.page * q.size, (q.page + 1) * q.size) }
  },
  async detail(id: number) {
    await wait(); const t = S.txs[id - 1], v = view(t), led = S.led.filter(l => l.tx === id).map(l => ({ kind: l.kind, account: label(l.acc), amount: l.amt }))
    return { ...v, ledger: led, balanced: r2(led.filter(l => l.kind === 'DEBIT').reduce((a, l) => a + l.amount, 0)) === r2(led.filter(l => l.kind === 'CREDIT').reduce((a, l) => a + l.amount, 0)) }
  },
  async goals() { await wait(); S.goals.forEach(g => { if (g.status === 'ACTIVE' && acc(MYW).bal >= g.target) g.status = 'COMPLETED' }); save(); return S.goals.map(goalView) },
  async createGoal(name: string, target: number, deadline: string) {
    await wait(); if (!name.trim()) throw new ApiError(400, 'Give the goal a name.'); if (!(target > 0)) throw new ApiError(400, 'Target must be above zero.')
    if (!deadline || new Date(deadline) <= new Date()) throw new ApiError(400, 'Pick a deadline in the future.')
    S.goals.push({ id: S.goals.length + 1, name: name.trim(), target, deadline, status: 'ACTIVE' }); save()
  },
  async setGoal(id: number, status: Goal['status']) { await wait(); S.goals.find(g => g.id === id)!.status = status; save() }
}
