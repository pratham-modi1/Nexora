import './app.css'
import { api, demo, DEMO, LIMITS, type ApiError } from './data'
import { hasValidToken, currentRole, msUntilExpiry, clearSession } from '../api'
import { adminApi, refOf } from './admin'

if (!hasValidToken()) location.replace('/')
const $ = (s: string) => document.querySelector(s) as HTMLElement
const view = $('#view')
const num = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inr = (n: number) => '₹' + num(n)
const whole = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const toast = (m: string) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2800) }
const ic = (p: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`
const I = {
  user: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'), mail: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  cal: ic('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'), layers: ic('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  pulse: ic('<path d="M3 12h4l3-7 4 14 3-7h4"/>'), lock: ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'), check: ic('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'), chev: ic('<path d="M6 9l6 6 6-6"/>')
}
const ADMIN = !DEMO && currentRole() === 'ADMIN'          // admins have no wallet, so they get their own console
const ROUTES = ADMIN ? ['admin', 'profile'] : ['home', 'activity', 'goals', 'profile']
let terrain: { setPage(i: number, j?: boolean): void; ripple(): void } | null = null
const prev: Record<string, number> = {}
function countUp(el: HTMLElement, id: string, to: number) {
  const from = prev[id] ?? 0; prev[id] = to
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = inr(to); return }
  const t0 = performance.now(); const f = (t: number) => { const k = Math.min(1, (t - t0) / 800); el.textContent = inr(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(f) }
  requestAnimationFrame(f)
}

// ---------- slide-over sheet ----------
function sheet(html: string) {
  const root = $('#sheet'); root.innerHTML = `<div class="scrim"></div><aside class="sh"><button class="x" aria-label="Close">×</button><div class="shb">${html}</div></aside>`
  requestAnimationFrame(() => root.classList.add('on'))
  const close = () => { root.classList.remove('on'); setTimeout(() => (root.innerHTML = ''), 280) }
  root.querySelector('.scrim')!.addEventListener('click', close); root.querySelector('.x')!.addEventListener('click', close)
  return { body: root.querySelector('.shb') as HTMLElement, close }
}
const row = (t: any) => {
  const sign = t.dir === 'SENT' ? '−' : t.dir === 'RECEIVED' ? '+' : '', cls = t.dir === 'SENT' ? 'dr' : t.dir === 'RECEIVED' ? 'cr' : ''
  return `<button class="tx" data-id="${t.id}"><span class="dot ${cls}"></span><span class="tt"><b>${esc(t.title)}</b><small>${fmtDate(t.at)} <i>·</i> Ref: ${t.ref}</small></span>${t.status !== 'COMPLETED' ? `<em class="chip">${t.status.toLowerCase()}</em>` : ''}<span class="am">${sign}${inr(t.amount)}</span></button>`
}
const bindRows = (root: HTMLElement) => root.querySelectorAll<HTMLElement>('.tx').forEach(b => (b.onclick = () => openLedger(+b.dataset.id!)))
async function openLedger(id: number) {
  const { body } = sheet('<p class="mut">Loading…</p>'), d = await api.detail(id)
  body.innerHTML = `<p class="lbl">Transaction</p><h2>${esc(d.title)}</h2><div class="amt">${inr(d.amount)}</div>
  <dl class="kv"><dt>Reference</dt><dd>${d.ref}</dd><dt>Status</dt><dd>${d.status.toLowerCase()}</dd><dt>Date</dt><dd>${fmtDate(d.at)} IST</dd><dt>From</dt><dd>${esc(d.from)}</dd><dt>To</dt><dd>${esc(d.to)}</dd>${d.orig ? `<dt>Reverses</dt><dd>${d.orig}</dd>` : ''}${d.key ? `<dt>Request key</dt><dd class="mono">${esc(d.key)}</dd>` : ''}</dl>
  ${d.ledger.length ? `<p class="lbl">Ledger entries</p><div class="led">${d.ledger.map(l => `<div><span class="k ${l.kind === 'DEBIT' ? 'dr' : 'cr'}">${l.kind.toLowerCase()}</span><span>${esc(l.account)}</span><b>${inr(l.amount)}</b></div>`).join('')}</div>
  ${d.balanced ? '<p class="bal ok">Debits equal credits</p>' : '<p class="fine">Entries are derived from this transaction: one debit and one credit of the same amount.</p>'}` : ''}`
}

// ---------- move money ----------
type Mode = 'add' | 'send' | 'bank'
const MODES: Record<Mode, { name: string; from: 'bank' | 'wallet'; verb: string; flow: string }> = {
  add: { name: 'Add money', from: 'bank', verb: 'Add to wallet', flow: 'fwd' }, send: { name: 'Send', from: 'wallet', verb: 'Send money', flow: 'out' }, bank: { name: 'To bank', from: 'wallet', verb: 'Move to bank', flow: 'rev' }
}
async function openPanel(mode: Mode) {
  const { body, close } = sheet('<p class="mut">Loading…</p>'), bal = await api.accounts()
  let key = crypto.randomUUID(), lastSig = '', busy = false
  const draw = () => {
    const m = MODES[mode]
    body.innerHTML = `<div class="seg">${(Object.keys(MODES) as Mode[]).map(k => `<button data-m="${k}" class="${k === mode ? 'on' : ''}">${MODES[k].name}</button>`).join('')}</div>
    <p class="mut">Available in ${m.from}: <b class="w">${inr(bal[m.from].balance)}</b></p>
    ${mode === 'send' ? '<label>Recipient email<input id="to" type="email" placeholder="rahul@nexora.demo" autocomplete="off"/></label>' : ''}
    <label>Amount<div class="amtin"><span>₹</span><input id="amt" inputmode="decimal" placeholder="0" autocomplete="off"/></div></label>
    <div class="chips">${[500, 1000, 2000].map(v => `<button data-v="${v}">₹${v.toLocaleString('en-IN')}</button>`).join('')}</div>
    <p id="err" class="err"></p><button id="go" class="cta">${m.verb}</button>
    <p class="fine">Limit ₹${LIMITS.perTx.toLocaleString('en-IN')} per transaction · wallet max ₹${LIMITS.walletMax.toLocaleString('en-IN')}</p>
    ${DEMO ? '<label class="dev"><input id="drop" type="checkbox"/> Demo: lose the next response, then retry</label>' : ''}`
    body.querySelectorAll<HTMLElement>('[data-m]').forEach(b => (b.onclick = () => { mode = b.dataset.m as Mode; key = crypto.randomUUID(); lastSig = ''; draw() }))
    body.querySelectorAll<HTMLElement>('[data-v]').forEach(b => (b.onclick = () => ((body.querySelector('#amt') as HTMLInputElement).value = b.dataset.v!)))
    if (DEMO) (body.querySelector('#drop') as HTMLInputElement).onchange = e => (e.target as HTMLInputElement).checked && demo.dropNextResponse()
    ;(body.querySelector('#go') as HTMLButtonElement).onclick = submit
  }
  const submit = async () => {
    if (busy) return
    const amt = parseFloat((body.querySelector('#amt') as HTMLInputElement).value), to = (body.querySelector('#to') as HTMLInputElement | null)?.value ?? '', err = body.querySelector('#err')!, go = body.querySelector('#go') as HTMLButtonElement
    const sig = `${mode}|${to}|${amt}`; if (sig !== lastSig) key = crypto.randomUUID(); lastSig = sig // same details = same key, so a retry can never double-spend
    busy = true; go.disabled = true; go.textContent = 'Processing…'; err.textContent = ''
    try {
      const r = await (mode === 'add' ? api.addMoney(amt, key) : mode === 'bank' ? api.toBank(amt, key) : api.send(to, amt, key))
      const flow = MODES[mode].flow; key = crypto.randomUUID(); lastSig = ''
      body.innerHTML = `<div class="done"><i></i><h2>${r.replayed ? 'Already processed' : 'Done'}</h2><div class="amt">${inr(r.tx.amount)}</div><p class="mut">${esc(r.tx.title)} · ${r.tx.ref}</p><button class="cta" id="ok">Close</button></div>`
      body.querySelector<HTMLElement>('#ok')!.onclick = close; terrain?.ripple(); await route(true); pulse(flow)
    } catch (e) { err.textContent = (e as Error).message; go.disabled = false; go.textContent = MODES[mode].verb }
    busy = false
  }
  draw()
}
function pulse(k: string) { const f = document.querySelector('.flow'); if (!f) return; f.classList.remove('fwd', 'rev', 'out'); void (f as HTMLElement).offsetWidth; f.classList.add(k) }

// ---------- views ----------
const goalRow = (g: any) => `<div class="g"><div class="gt"><span>${esc(g.name)}</span><span class="n">${whole(g.saved)} of ${whole(g.target)}</span></div><div class="bar ${g.status === 'COMPLETED' ? 'done' : ''}"><i style="width:${g.progress * 100}%"></i></div><small class="cap">${g.status === 'COMPLETED' ? 'Goal reached' : g.status !== 'ACTIVE' ? g.status.toLowerCase() : (g.progress * 100).toFixed(1) + '% completed'}</small></div>`
async function home() {
  const [a, tx, goals] = await Promise.all([api.accounts(), api.list({ page: 0, size: 2 }), api.goals()])
  view.innerHTML = `<div class="home"><section class="bal"><p class="lbl">Wallet balance</p><div class="bigbal" id="w"></div><div class="flow"><u></u><i></i></div>
  <p class="lbl">Bank balance</p><div class="bank" id="b"></div><div class="acts"><button data-m="add">Add money</button><button data-m="send">Send</button><button data-m="bank">To bank</button></div></section>
  <section class="rt"><article class="panel"><div class="ph"><h3>Recent transactions</h3><a href="#/activity">View all →</a></div><div class="list">${tx.items.map(row).join('') || '<p class="mut">No transactions yet.</p>'}</div></article>
  <article class="panel"><div class="ph"><h3>Savings goals</h3><a href="#/goals">View goals →</a></div>${goals.filter(g => g.status !== 'CANCELLED').slice(0, 2).map(goalRow).join('') || '<p class="mut">No goals yet.</p>'}</article></section></div>`
  countUp($('#w'), 'w', a.wallet.balance); countUp($('#b'), 'b', a.bank.balance)
  view.querySelectorAll<HTMLElement>('.acts [data-m]').forEach(b => (b.onclick = () => openPanel(b.dataset.m as Mode))); bindRows(view)
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)
async function activity() {
  let days = 30, page = 0
  const since = new Date(); since.setMonth(since.getMonth() - 5, 1)
  const trend = (await api.list({ page: 0, size: 1000, from: ymd(since) })).items
  const r0 = await load()
  async function load() { return api.list({ page: 0, size: 1000, from: days ? ymd(new Date(Date.now() - days * 864e5)) : '' }) }
  const draw = (items: any[]) => {
    const credit = items.filter(x => x.dir === 'RECEIVED').reduce((s, x) => s + x.amount, 0), sent = items.filter(x => x.dir === 'SENT'), debit = sent.reduce((s, x) => s + x.amount, 0)
    const by: Record<string, number> = {}; sent.forEach(x => (by[x.who] = (by[x.who] || 0) + x.amount))
    let segs = Object.entries(by).sort((a, b) => b[1] - a[1]); if (segs.length > 3) segs = [...segs.slice(0, 3), ['others', segs.slice(3).reduce((s, x) => s + x[1], 0)]]
    const C = 2 * Math.PI * 62; let acc = 0; const tone = ['#f4f7fb', '#aab9cb', '#6c7d92', '#43505f']
    const arcs = segs.map(([, v], i) => { const L = (v / debit) * C, o = `<circle cx="80" cy="80" r="62" stroke="${tone[i]}" stroke-dasharray="${Math.max(0, L - 3)} ${C}" stroke-dashoffset="${-acc}"/>`; acc += L; return o }).join('')
    const now = new Date(), keys = Array.from({ length: 6 }, (_, i) => { const m = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1); return `${m.getFullYear()}-${m.getMonth()}` })
    const lbl = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (5 - i), 1).toLocaleString('en-IN', { month: 'short' }))
    const cum = [0, 0, 0, 0, 0, 0]   // net flow per month (received − sent); own transfers and the opening credit are excluded
    trend.forEach(x => { if (x.dir === 'INTERNAL' || x.type === 'OPENING_BALANCE') return; const dt = new Date(x.at), i = keys.indexOf(`${dt.getFullYear()}-${dt.getMonth()}`); if (i >= 0) cum[i] += x.dir === 'RECEIVED' ? x.amount : -x.amount })
    const mn = Math.min(...cum, 0), mx = Math.max(...cum, 0), px = (i: number) => 30 + i * 68, py = (v: number) => 100 - (mx === mn ? 0.4 : (v - mn) / (mx - mn)) * 70
    let d = `M${px(0)} ${py(cum[0])}`; for (let i = 1; i < 6; i++) d += ` C${(px(i - 1) + px(i)) / 2} ${py(cum[i - 1])} ${(px(i - 1) + px(i)) / 2} ${py(cum[i])} ${px(i)} ${py(cum[i])}`
    const pct = cum[4] ? ((cum[5] - cum[4]) / Math.abs(cum[4])) * 100 : null   // this month vs last month
    const pages = Math.max(1, Math.ceil(items.length / 5)); page = Math.min(page, pages - 1)
    view.innerHTML = `<div class="ttl"><div><h1>Activity</h1><p class="sub">All your transactions, in one place.</p></div><label class="sel"><select id="rng">${[[7, 'Last 7 Days'], [30, 'Last 30 Days'], [90, 'Last 90 Days'], [0, 'All time']].map(([v, l]) => `<option value="${v}" ${v === days ? 'selected' : ''}>${l}</option>`).join('')}</select>${I.chev}</label></div>
    <div class="stats"><div class="stat"><p class="lbl">Total credit</p><b>${inr(credit)}</b></div><div class="stat"><p class="lbl">Total debit</p><b>${inr(debit)}</b></div><div class="stat"><p class="lbl">Net change</p><b>${credit - debit >= 0 ? '+' : '−'}${inr(Math.abs(credit - debit))}</b></div></div>
    <div class="act2"><article class="panel"><div class="ph"><h3>Transaction history</h3><span class="pg"><button id="pv" ${page ? '' : 'disabled'}>‹</button>${page + 1}/${pages}<button id="nx" ${page + 1 < pages ? '' : 'disabled'}>›</button><a id="ex" href="#">Export ↓</a></span></div><div class="list">${items.slice(page * 5, page * 5 + 5).map(row).join('') || '<p class="mut pad">Nothing in this period.</p>'}</div></article>
    <div class="stack"><article class="panel"><div class="ph"><h3>Spending overview</h3></div>${debit ? `<div class="donut"><svg viewBox="0 0 160 160" fill="none" stroke-width="9">${`<circle cx="80" cy="80" r="62" stroke="rgba(255,255,255,.1)"/>`}<g transform="rotate(-90 80 80)">${arcs}</g></svg><div class="dc"><b>${inr(debit)}</b><small class="lbl">Total spent</small></div>
    <ul>${segs.map(([n, v], i) => `<li><i style="background:${tone[i]}"></i><span>${esc(n as string)}</span><b>${Math.round((v / debit) * 100)}%</b></li>`).join('')}</ul></div>` : '<p class="mut pad">No spending in this period.</p>'}</article>
    <article class="panel"><div class="ph"><h3>Monthly trend</h3><span class="${pct === null || pct >= 0 ? 'cr' : 'dr'}">${pct === null ? '—' : (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% ↗'}</span></div>
    <svg class="trend" viewBox="0 0 400 140"><defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="${d} L${px(5)} 112 L${px(0)} 112Z" fill="url(#tg)"/><path d="${d}" fill="none" stroke="#f4f7fb" stroke-width="1.6"/><line x1="20" x2="380" y1="112" y2="112" stroke="rgba(255,255,255,.18)"/>${cum.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="3.5" fill="#fff"/><text x="${px(i)}" y="132" text-anchor="middle">${lbl[i]}</text>`).join('')}</svg></article></div></div>`
    bindRows(view)
    ;($('#rng') as HTMLSelectElement).onchange = async e => { days = +(e.target as HTMLSelectElement).value; page = 0; draw((await load()).items) }
    $('#pv').onclick = () => { page--; draw(items) }; $('#nx').onclick = () => { page++; draw(items) }
    $('#ex').onclick = e => { e.preventDefault(); const csv = ['reference,date,type,description,amount,status', ...items.map(x => [x.ref, x.at, x.type, `"${x.title}"`, x.amount, x.status].join(','))].join('\n'); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'nexora-activity.csv' }); a.click() }
  }
  draw(r0.items)
}

async function goals() {
  const g = (await api.goals()), wallet = (await api.accounts()).wallet.balance, live = g.filter(x => x.status !== 'CANCELLED'), saved = live.length ? wallet : 0, avg = live.length ? Math.min(100, (wallet / live.reduce((s, x) => s + x.target, 0)) * 100) : 0
  view.innerHTML = `<div class="ttl"><div><h1>Goals</h1><p class="sub">Plan · Save · Achieve</p></div></div>
  <div class="stats"><div class="stat"><p class="lbl">Total goals</p><b>${live.length}</b></div><div class="stat"><p class="lbl">Total saved</p><b>${inr(saved)}</b></div><div class="stat"><p class="lbl">Overall progress</p><b class="pr">${avg.toFixed(1)}%<span class="bar"><i style="width:${avg}%"></i></span></b></div></div>
  <article class="panel big"><div class="ph"><h3>Your goals</h3><a href="#" id="ng">Add goal +</a></div>${live.map(x => `<div class="gr ${x.status.toLowerCase()}"><div class="gn">${esc(x.name)}<small style="font-size:12px;letter-spacing:.06em">Due ${fmtDate(x.deadline)} · ${x.status === 'COMPLETED' ? 'done' : x.overdue ? 'overdue' : x.monthsLeft + ' mo left'}${x.status === 'ACTIVE' && !x.overdue ? ' · save ' + whole(x.monthly) + '/mo' : ''}</small><small class="ga">${x.status === 'COMPLETED' ? 'Goal reached' : `${x.status === 'ACTIVE' ? `<a href="#" data-g="${x.id}" data-s="PAUSED">Pause</a>` : `<a href="#" data-g="${x.id}" data-s="ACTIVE">Resume</a>`} · <a href="#" data-g="${x.id}" data-s="CANCELLED">Cancel</a>`}</small></div><span class="p">${(x.progress * 100).toFixed(1)}%</span><div class="bar ${x.status === 'COMPLETED' ? 'done' : ''}"><i style="width:${x.progress * 100}%"></i></div><span class="n">${whole(x.saved)} of ${whole(x.target)}</span></div>`).join('') || '<p class="mut pad">No goals yet. Add one to start tracking.</p>'}
  <p class="fine l">Tracking only. Progress follows your wallet balance and doesn't move any money.</p></article>`
  view.querySelectorAll<HTMLElement>('[data-g]').forEach(b => (b.onclick = async e => { e.preventDefault(); await api.setGoal(+b.dataset.g!, b.dataset.s as any); goals() }))
  $('#ng').onclick = e => {
    e.preventDefault(); const { body, close } = sheet(`<h2>New goal</h2><label>Name<input id="n"/></label><label>Target amount<div class="amtin"><span>₹</span><input id="t" inputmode="decimal"/></div></label><label>Deadline<input id="d" type="date"/></label><p class="err" id="e"></p><button class="cta" id="c">Create goal</button>`)
    ;(body.querySelector('#c') as HTMLElement).onclick = async () => { try { await api.createGoal((body.querySelector('#n') as HTMLInputElement).value, parseFloat((body.querySelector('#t') as HTMLInputElement).value), (body.querySelector('#d') as HTMLInputElement).value); close(); goals() } catch (e) { body.querySelector('#e')!.textContent = (e as ApiError).message } }
  }
}

async function profile() {
  const [me, all] = await Promise.all([api.me(), ADMIN ? Promise.resolve({ items: [] as { at: string }[] }) : api.list({ page: 0, size: 1000 })])
  const handle = me.email.split('@')[0], name = handle.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ini = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const since = all.items.length ? fmtDate(all.items[all.items.length - 1].at) : '—'
  view.innerHTML = `<div class="prof"><section class="who"><div class="av"><span>${esc(ini)}</span></div><h2>${esc(name)}</h2><p class="ok2">${I.check}<span>Verified account</span></p></section><i class="vr"></i>
  <section class="info">${[[I.mail, 'Email', esc(me.email)], [I.cal, 'Member since', since], [I.layers, 'Account type', me.role === 'ADMIN' ? 'Admin' : 'Standard'], [I.pulse, 'Account status', '<i class="live"></i>Active']].map(([ico, l, v]) => `<div class="ir"><span class="tile">${ico}</span><div><p class="lbl">${l}</p><p class="v">${v}</p></div></div>`).join('')}</section></div>`
}

// ---------- admin console ----------
const logRow = (e: { reversalTransactionId: number; originalTransactionId: number; amount: number; at: string }) =>
  `<div class="tx"><span class="dot dr"></span><span class="tt"><b>${refOf(e.originalTransactionId)} reversed</b><small>${fmtDate(e.at)} <i>·</i> Correction: ${refOf(e.reversalTransactionId)}</small></span><span class="am">${inr(e.amount)}</span></div>`
async function admin() {
  view.innerHTML = `<div class="ttl"><div><h1>Admin</h1><p class="sub">Reverse transactions and audit the ledger.</p></div></div>
  <div class="act2"><article class="panel"><div class="ph"><h3>Reverse a transaction</h3></div>
  <label>Transaction reference or ID<input id="rid" placeholder="NX-000123 or 123" autocomplete="off"/></label>
  <p id="rerr" class="err"></p><button id="rgo" class="cta">Reverse transaction</button>
  <p class="fine">Only completed Add money, Withdrawal and Transfer transactions can be reversed. This posts a correcting entry and can't be undone.</p>
  <div class="ph"><h3>Reversals from this browser</h3></div><div class="list" id="rlog"></div></article>
  <article class="panel"><div class="ph"><h3>Ledger reconciliation</h3><a href="#" id="rc">Run check ↻</a></div><div class="list" id="rres"><p class="mut">Checking…</p></div></article></div>`
  const drawLog = () => ($('#rlog').innerHTML = adminApi.log().map(logRow).join('') || '<p class="mut">No reversals yet.</p>')
  const reconcile = async () => {
    const box = $('#rres'); box.innerHTML = '<p class="mut">Checking…</p>'
    try {
      const r = await adminApi.reconcile(), ok = r.status === 'OK'
      box.innerHTML = `<div class="tx"><span class="dot ${ok ? 'cr' : 'dr'}"></span><span class="tt"><b>${ok ? 'Ledger is consistent' : 'Mismatch found'}</b><small>Checked ${new Date(r.checkedAt).toLocaleString('en-IN')}</small></span></div>` +
        r.checks.map(c => `<div class="tx"><span class="dot ${c.passed ? 'cr' : 'dr'}"></span><span class="tt"><b>${esc(c.name.replace(/_/g, ' ').toLowerCase())}</b><small>${esc(c.details || '')}${c.offenders?.length ? ' <i>·</i> ' + esc(c.offenders.join(', ')) : ''}</small></span><span class="am">${c.passed ? 'pass' : 'fail'}</span></div>`).join('')
    } catch (e) { box.innerHTML = `<p class="err">${esc((e as Error).message)}</p>` }
  }
  drawLog(); reconcile()
  $('#rc').onclick = e => { e.preventDefault(); reconcile() }
  $('#rgo').onclick = async () => {
    const inp = $('#rid') as HTMLInputElement, err = $('#rerr'), btn = $('#rgo') as HTMLButtonElement
    err.textContent = ''; if (!inp.value.trim()) { err.textContent = 'Enter a transaction ID.'; return }
    if (!confirm(`Reverse transaction ${inp.value.trim()}? This cannot be undone.`)) return
    btn.disabled = true; btn.textContent = 'Reversing…'
    try { const r = await adminApi.reverse(inp.value); inp.value = ''; toast(`Reversed ${refOf(r.originalTransactionId)} → ${refOf(r.reversalTransactionId)}`); drawLog(); reconcile() }
    catch (e) { err.textContent = (e as Error).message }
    btn.disabled = false; btn.textContent = 'Reverse transaction'
  }
}

// ---------- shell + router ----------
$('#top').innerHTML = `<a class="brand" href="#/${ROUTES[0]}"><span class="logo">NEXORA</span><i class="sep"></i><span class="tag">Next generation finance</span></a><nav>${ROUTES.map(r => `<a href="#/${r}" data-r="${r}">${r}</a>`).join('')}<i class="sep v"></i><button id="um" aria-label="Account menu">${I.user}</button><div id="menu"><button id="lo">Log out</button>${DEMO ? '<button id="rs">Reset sample data</button>' : ''}</div></nav>`
$('#top').style.zIndex = '10'   // keep the account dropdown above the page content, otherwise clicks on 'Log out' hit the page underneath
$('#foot').innerHTML = `<span>Secured by <b>Nexora</b></span><div><a href="#">Privacy</a><i></i><a href="#">Terms</a><i></i><a href="#">Help</a></div>`
$('#foot').querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.preventDefault()))
$('#um').onclick = e => { e.stopPropagation(); $('#menu').classList.toggle('on') }; addEventListener('click', () => $('#menu').classList.remove('on'))
$('#lo').onclick = () => { clearSession(); try { localStorage.removeItem('nexora_email') } catch {} location.replace('/') }; if (DEMO) $('#rs').onclick = () => { demo.reset(); toast('Sample data reset'); route(true) }
{ const ms = msUntilExpiry(); if (ms !== null && !DEMO) setTimeout(() => { toast('Session expired. Logging you out…'); setTimeout(() => { clearSession(); location.href = '/' }, 1500) }, Math.max(0, ms)) }
const V: Record<string, () => Promise<void>> = { home, activity, goals, profile, admin }
async function route(silent = false) {
  const r = location.hash.replace('#/', '') || ROUTES[0], name = ROUTES.includes(r) ? r : ROUTES[0]
  document.querySelectorAll('#top nav a').forEach(a => a.classList.toggle('on', (a as HTMLElement).dataset.r === name)); terrain?.setPage(ROUTES.indexOf(name))
  if (!silent) { view.classList.remove('in'); void view.offsetWidth; view.classList.add('in') }
  try { await V[name]() } catch (e) { toast((e as Error).message) }
}
addEventListener('hashchange', () => route()); route()
import('./terrain').then(m => { try { terrain = m.startTerrain($('#bg') as HTMLCanvasElement); terrain.setPage(Math.max(0, ROUTES.indexOf(location.hash.replace('#/', '') || ROUTES[0])), true) } catch { /* no WebGL: CSS fallback glow stays */ } })
addEventListener('pageshow', e => { if ((e as PageTransitionEvent).persisted && !hasValidToken()) location.replace('/') })   // Back button after logout must not show the app