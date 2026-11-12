import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { startAudio, cue } from './audio'
import { login, register, onAuthSuccess, hasValidToken, SKIP_INTRO_IF_LOGGED_IN } from './api'
import './style.css'
const $ = (s: string) => document.querySelector(s) as HTMLElement
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mobile = innerWidth < 800
if (SKIP_INTRO_IF_LOGGED_IN && hasValidToken()) onAuthSuccess()
startAudio()

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#c') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight)
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000)
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6
const cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400); scene.add(cam)
const comp = new EffectComposer(renderer); comp.addPass(new RenderPass(scene, cam))
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.45, 0.25); comp.addPass(bloom); comp.addPass(new OutputPass())
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); comp.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix() })
const U = { t: { value: 0 } }, VIS = { value: 0 }, misc: [THREE.LineBasicMaterial, number][] = []

// ---------- line tunnel ----------
const NF = mobile ? 18 : 26, SP = 6, W = 14, H = 8, R = 1.7, END = -NF * SP * 0.62
function rr() {
  const pts: THREE.Vector3[] = [], cs = [[W / 2 - R, H / 2 - R, 0], [-(W / 2 - R), H / 2 - R, Math.PI / 2], [-(W / 2 - R), -(H / 2 - R), Math.PI], [W / 2 - R, -(H / 2 - R), Math.PI * 1.5]]
  for (const c of cs) for (let i = 0; i <= 8; i++) { const a = c[2] + (i / 8) * Math.PI / 2; pts.push(new THREE.Vector3(c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R, 0)) }
  return pts
}
const rpts = rr()
const lineMat = (k: number) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.t, uK: { value: k }, uV: VIS },
  vertexShader: `varying float vZ,vD,vP; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vD=-mv.z; vZ=position.z; vP=position.x*3.7+position.y*2.3; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float uTime,uK,uV; varying float vZ,vD,vP; void main(){ float pulse=pow(.5+.5*sin(vZ*.16+uTime*2.+vP),24.); float a=(.16+pulse*.95)*exp(-max(vD,0.)*.016)*step(0.,vD)*uV; gl_FragColor=vec4(vec3(.85,.92,1.)*a*uK,a*uK); }`
})
function tunnel(refl: boolean) {
  const g = new THREE.Group(), k = refl ? 0.28 : 1, frames: THREE.LineLoop[] = []
  for (let i = 0; i < NF; i++) { const f = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rpts), new THREE.LineBasicMaterial({ color: 0xe6eefa, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.z = -i * SP; g.add(f); frames.push(f) }
  const keys = [0, 8, 9, 17, 18, 26, 27, 35], pos: number[] = [], L = NF * SP + 40, S = 90
  for (const ki of keys) for (let s = 0; s < S; s++) { const p = rpts[ki]; pos.push(p.x, p.y, 30 - (s / S) * L, p.x, p.y, 30 - ((s + 1) / S) * L) }
  const dg: number[] = []
  ;[[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => { for (let s = 0; s < 30; s++) { const a = s / 30, b = (s + 1) / 30; dg.push(sx * (W / 2 + a * 22), sy * (H / 2 + a * 12), a * 20, sx * (W / 2 + b * 22), sy * (H / 2 + b * 12), b * 20) } })
  for (const arr of [pos, dg]) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.add(Object.assign(new THREE.LineSegments(lg, lineMat(k)), { frustumCulled: false })) }
  const z = -NF * SP * 0.72, cp: THREE.Vector3[] = []
  for (let i = 0; i < 160; i++) { const a = (i / 160) * 6.2832; cp.push(new THREE.Vector3(Math.cos(a) * 9.5, Math.sin(a) * 9.5, z)) }
  const m1 = new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }), m2 = m1.clone()
  misc.push([m1, 0.18 * k], [m2, 0.14 * k])
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(cp), m1))
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -30, z), new THREE.Vector3(0, 30, z), new THREE.Vector3(-30, 0, z), new THREE.Vector3(30, 0, z)]), m2))
  return { g, frames, k }
}
const real = tunnel(false), mirror = tunnel(true)
mirror.g.scale.y = -1; mirror.g.position.y = -H; scene.add(real.g, mirror.g)

// ---------- dynamic particle terrain (login backdrop) ----------
const surfaceGeometry = (() => {
  const positions: number[] = [], cols = mobile ? 84 : 132, rows = mobile ? 64 : 92, width = 22, depth = 25
  for (let zi = 0; zi <= rows; zi++) { const z = (zi / rows - 0.5) * depth; for (let xi = 0; xi <= cols; xi++) positions.push((xi / cols - 0.5) * width, 0, z) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); return g
})()
const surfaceUniforms = { uTime: U.t, uPixelRatio: { value: renderer.getPixelRatio() }, uReveal: { value: 0 } }
const surfaceMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: surfaceUniforms,
  vertexShader: `
    uniform float uTime; uniform float uPixelRatio; varying float vEnergy; varying float vFade;
    void main() {
      float x = position.x; float z = position.z;
      float p1 = x * .21 + z * .24 + uTime * .36; float p2 = x * .38 - z * .11 - uTime * .26; float p3 = z * .48 + uTime * .19;
      float h = sin(p1) * 1.55 + cos(p2) * .75 + sin(p3) * .38;
      vec3 p = position; p.y = h;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      float crest = pow(.5 + .5 * sin(p1 + .65 * cos(p2)), 9.0); float secondary = pow(.5 + .5 * cos(p2 * 1.15), 7.0);
      vEnergy = .24 + crest * .75 + secondary * .2;
      float edgeX = 1.0 - smoothstep(8.0, 11.0, abs(x)); float edgeZ = 1.0 - smoothstep(9.0, 12.5, abs(z));
      vFade = edgeX * edgeZ;
      float perspective = clamp(22.0 / max(8.0, -mv.z), .7, 1.35);
      gl_PointSize = uPixelRatio * (1.35 + vEnergy * 1.45) * perspective;
    }`,
  fragmentShader: `
    uniform float uReveal; varying float vEnergy; varying float vFade;
    void main() {
      float d = length(gl_PointCoord - vec2(.5)) * 2.0;
      float core = 1.0 - smoothstep(.12, .58, d); float halo = exp(-d * 4.8) * .35;
      float alpha = (core * .88 + halo * .34) * vFade * uReveal;
      vec3 cool = vec3(.32, .48, .66); vec3 silver = vec3(.86, .93, 1.0);
      vec3 color = mix(cool, silver, clamp(vEnergy, 0.0, 1.0)); color *= .72 + vEnergy * .5;
      gl_FragColor = vec4(color, alpha);
    }`
})
const surface = new THREE.Group(), terrainPoints = new THREE.Points(surfaceGeometry, surfaceMaterial)
terrainPoints.frustumCulled = false; surface.add(terrainPoints); surface.rotation.x = 0.58
surface.position.set(mobile ? 1.2 : 6.8, -0.4, END - 24); surface.visible = false; scene.add(surface)

// ---------- text ----------
const TAG = 'NEXT GENERATION FINANCE', tag = $('#tag')
tag.innerHTML = [...TAG].map(c => `<span>${c === ' ' ? '&nbsp;' : c}</span>`).join('')
const tagEls = Array.from(tag.children) as HTMLElement[]
const CAPS = [
  ['01 — SECURITY', 'SECURE BY DESIGN', 'JWT-protected sessions and layered checks keep every rupee behind more than one door.'],
  ['02 — TRANSFERS', 'INSTANT, TRACEABLE', 'Send money in seconds and watch it land in a live, searchable timeline.'],
  ['03 — GOALS', 'SAVE WHAT MATTERS', 'Create savings goals, fund them in a tap, and watch progress fill as you grow.']
]
const SIDE = ['l', 'r', 'l'], SHK = [0, 0, 0.13, -0.13, 0.13, 0]
const SH = (s: number) => { const i = Math.min(4, Math.floor(s)); return lerp(SHK[i], SHK[i + 1], s - i) }
const capEls = CAPS.map((c, i) => { const d = document.createElement('div'); d.className = 'cap ' + SIDE[i]; d.innerHTML = `<small>${c[0]}</small><h2>${c[1]}</h2><p>${c[2]}</p>`; $('#caps').appendChild(d); return d })
const dotEls = Array.from({ length: 6 }, () => { const i = document.createElement('i'); $('#dots').appendChild(i); return i })

// ---------- step navigation ----------
const LAST = 5
let step = 0, sA = 0, sB = 0, t0 = -99, dur = 1, lock = 0, tagT = -1
const ez = (k: number) => k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
const nowS = () => performance.now() / 1000
const sCur = () => { const k = (nowS() - t0) / dur; return k >= 1 ? sB : lerp(sA, sB, ez(Math.max(0, k))) }
function go(d: number) {
  const n = Math.min(LAST, Math.max(0, step + d)), now = nowS()
  if (n === step || now < lock) return
  // Continue from the current camera position, even if the previous transition has not finished yet.
  sA = sCur(); sB = n; step = n; t0 = now
  dur = n <= 1 ? 0.30 : 0.55   // fast transitions
  lock = now + 0.12            // small input gate, allows key auto-repeat
  if (d > 0 && n >= 2 && n <= 4) cue('pass')
  if (n === LAST) cue('flare')
}
const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')

// One navigation step per short wheel gesture.
let wheelLock = 0
addEventListener('wheel', e => {
  if (Math.abs(e.deltaY) <= 12) return
  e.preventDefault()
  const now = nowS(); if (now < wheelLock) return
  wheelLock = now + 0.32; go(e.deltaY > 0 ? 1 : -1)
}, { passive: false })
addEventListener('keydown', e => {
  if (typing()) return
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1) }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1) }
})
let ty = 0
addEventListener('touchstart', e => { ty = e.touches[0].clientY }, { passive: true })
addEventListener('touchend', e => { const d = ty - e.changedTouches[0].clientY; if (Math.abs(d) > 45 && !typing()) go(d > 0 ? 1 : -1) })
const mouse = new THREE.Vector2()
addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1) })

// ---------- login / register (email + password only) ----------
let mode: 'login' | 'register' = 'login'
const em = $('#em') as HTMLInputElement, pw = $('#pw') as HTMLInputElement, msg = $('#msg'), goBtn = $('#go') as HTMLButtonElement
function setMode(m: 'login' | 'register') {
  mode = m; const l = m === 'login'
  $('#h').textContent = l ? 'Welcome Back' : 'Create Account'
  $('#sub').textContent = l ? 'Log in to your NEXORA account' : 'Join NEXORA with just an email and password'
  $('#gl').textContent = l ? 'Log In' : 'Create Account'
  $('#swp').textContent = l ? 'Don’t have an account?' : 'Already have an account?'
  $('#sw').textContent = l ? 'Sign Up' : 'Log In'
  $('#fp').style.visibility = l ? 'visible' : 'hidden'
  pw.autocomplete = l ? 'current-password' : 'new-password'; msg.textContent = ''
}
$('#sw').onclick = () => setMode(mode === 'login' ? 'register' : 'login')
$('#fp').onclick = () => window.dispatchEvent(new CustomEvent('nexora:forgot-password', { detail: { email: em.value } })) // TODO: hook up your reset flow
$('#eye').onclick = () => { const s = pw.type === 'password'; pw.type = s ? 'text' : 'password'; $('#eye').classList.toggle('on', s) }
$('#f').onsubmit = async e => {
  e.preventDefault(); msg.style.color = '#ff9aa6'
  if (!/^\S+@\S+\.\S+$/.test(em.value.trim())) { msg.textContent = 'Please enter a valid email.'; return }
  if (mode === 'register' && pw.value.length < 8) { msg.textContent = 'Password must be at least 8 characters.'; return }
  if (!pw.value) { msg.textContent = 'Please enter your password.'; return }
  goBtn.disabled = true; msg.textContent = ''
  try { await (mode === 'login' ? login : register)(em.value.trim(), pw.value); msg.style.color = '#b9e6c9'; msg.textContent = 'Success'; setTimeout(onAuthSuccess, 500) }
  catch (err) { msg.textContent = (err as Error).message } finally { goBtn.disabled = false }
}

// ---------- animation loop ----------
const clock = new THREE.Clock(), look = new THREE.Vector3(), ZK = [30, 30, 8, -38, -88, END - 4]
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime(); U.t.value = t
  const s = sCur(), now = nowS(), i0 = Math.min(4, Math.floor(s)), z = lerp(ZK[i0], ZK[i0 + 1], s - i0)
  const tv = sm(1.3, 2, s) * (1 - sm(4.6, 5, s)); VIS.value = tv
  real.g.visible = mirror.g.visible = tv > 0.01
  misc.forEach(([m, b]) => { m.opacity = b * tv })
  const x = Math.sin(s * 2.4) * 2.2 * tv
  cam.position.set(x + mouse.x * 0.4 + Math.sin(t * 0.2) * 0.2, 0.2 + mouse.y * 0.25 + Math.cos(t * 0.17) * 0.1, z)
  look.set(x * 0.3, 0, z - 24); cam.lookAt(look)
  cam.rotation.z = -x * 0.01   // set, not accumulate, to avoid roll drift
  cam.fov = 55; cam.setViewOffset(innerWidth, innerHeight, mobile ? 0 : -innerWidth * SH(s), 0, innerWidth, innerHeight)
  ;[real, mirror].forEach(tu => tu.frames.forEach(f => {
    const dz = cam.position.z - f.position.z, ahead = dz > -1 ? Math.max(0, 1 - dz / 120) ** 1.4 : 0, near = Math.exp(-((dz - 7) ** 2) / 26) * 0.9
    ;(f.material as THREE.LineBasicMaterial).opacity = (0.12 + ahead * 0.5 + near) * tv * tu.k
  }))
  const sv = sm(4.7, 5, s); surface.visible = sv > 0.01; surfaceUniforms.uReveal.value = sv
  surface.rotation.y = Math.sin(t * 0.12) * 0.035 + mouse.x * 0.018; surface.rotation.x = 0.58 + mouse.y * 0.018
  $('#title').style.opacity = String(sm(0.3, 1.6, t) * (1 - sm(1.4, 2, s))); $('#title').style.transform = `scale(${1 + sm(1, 2, s) * 0.8})`
  if (step >= 1) { if (tagT < 0) tagT = now } else tagT = -1
  const n = tagT < 0 ? 0 : Math.floor((now - tagT) / 0.05); tagEls.forEach((e, i) => e.classList.toggle('on', i < n))
  capEls.forEach((el, i) => { const o = Math.max(0, 1 - Math.abs(s - (i + 2)) * 1.5); el.style.opacity = String(o); el.style.transform = `translate(${(1 - o) * (SIDE[i] === 'l' ? -26 : 26)}px,-50%)` })
  $('#flash').style.opacity = String(Math.exp(-(((s - 4.78) / 0.12) ** 2)) * 0.5); bloom.strength = 0.45 + 0.45 * Math.exp(-(((s - 4.78) / 0.2) ** 2))
  const a = sm(4.75, 5, s); $('#auth').style.opacity = String(a); $('#auth').classList.toggle('on', a > 0.9)
  $('#hint').style.opacity = String(0.7 * (1 - sm(1, 2, s)) * (now < lock ? 0.35 : 1) * sm(0.8, 2.2, t))
  $('#credit').style.opacity = String(0.6 * (1 - sm(1.2, 1.8, s)) * sm(0.8, 2.2, t))
  $('#dots').style.opacity = String(sm(1.5, 2, s)); dotEls.forEach((d, i) => d.classList.toggle('on', i === step))
  comp.render()
})
