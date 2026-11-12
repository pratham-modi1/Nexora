// ============================================================
//  AUDIO — edit CUES to use your own files (put them in /public/audio).
//  Browsers block sound until the user clicks, taps or presses a key,
//  so audio starts automatically on that first interaction.
//  Cues: ambient (loop), pass (each tunnel caption), flare (final light)
// ============================================================
export const CUES: Record<string, { file?: string; loop?: boolean; vol?: number }> = {
  ambient: { loop: true },   // e.g. { file: '/audio/ambient.mp3', loop: true }
  pass: {},                  // e.g. { file: '/audio/whoosh.mp3' }
  flare: {},                 // e.g. { file: '/audio/flare.mp3' }
}
let ac: AudioContext | null = null, master: GainNode | null = null, started = false
const rnd = Math.random
function build() {
  ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination)
  if (CUES.ambient.file) { const a = new Audio(CUES.ambient.file); a.loop = true; ac.createMediaElementSource(a).connect(master); a.play().catch(() => {}); return }
  ;[[49, 'sawtooth', .022], [49.4, 'sawtooth', .022], [98.3, 'sine', .05], [147, 'sine', .014]].forEach(([f, t, v]) => {
    const o = ac!.createOscillator(); o.type = t as OscillatorType; o.frequency.value = f as number
    const lp = ac!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; const g = ac!.createGain(); g.gain.value = v as number
    const l = ac!.createOscillator(), lg = ac!.createGain(); l.frequency.value = .06 + rnd() * .08; lg.gain.value = 45; l.connect(lg).connect(lp.frequency); l.start()
    o.connect(lp).connect(g).connect(master!); o.start()
  })
}
function go() { if (!ac) build(); ac!.resume().then(() => { if (!started) { started = true; master!.gain.linearRampToValueAtTime(.55, ac!.currentTime + 3) } }) }
export function startAudio() { // tries immediately; retries on first gesture
  try { go() } catch {}
  ;['pointerdown', 'keydown', 'touchend', 'wheel'].forEach(e => addEventListener(e, () => { if (!started) try { go() } catch {} }, { passive: true }))
}
function file(c: { file?: string; vol?: number }) { const a = new Audio(c.file); a.volume = c.vol ?? 1; ac!.createMediaElementSource(a).connect(master!); a.play().catch(() => {}) }
function burst(dur: number, f0: number, f1: number, vol: number) {
  const n = ac!.sampleRate * dur, b = ac!.createBuffer(1, n, ac!.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1
  const s = ac!.createBufferSource(); s.buffer = b; const f = ac!.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1; f.frequency.setValueAtTime(f0, ac!.currentTime); f.frequency.exponentialRampToValueAtTime(f1, ac!.currentTime + dur)
  const g = ac!.createGain(); g.gain.setValueAtTime(0, ac!.currentTime); g.gain.linearRampToValueAtTime(vol, ac!.currentTime + dur * .35); g.gain.exponentialRampToValueAtTime(.001, ac!.currentTime + dur); s.connect(f).connect(g).connect(master!); s.start()
}
export function cue(name: string) {
  if (!ac || !started) return; const c = CUES[name]; if (c?.file) return file(c)
  if (name === 'pass') burst(1.5, 300, 2200, .22)
  if (name === 'flare') { burst(2.2, 200, 4000, .35); [523, 784, 1047].forEach((f, i) => { const o = ac!.createOscillator(), g = ac!.createGain(); o.frequency.value = f; const t = ac!.currentTime + i * .12; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .04); g.gain.exponentialRampToValueAtTime(.0005, t + 2.2); o.connect(g).connect(master!); o.start(t); o.stop(t + 2.3) }) }
}
