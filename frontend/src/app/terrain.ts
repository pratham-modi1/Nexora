import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
// Full-screen particle terrain behind the app: bright ridge crests, dark valleys, darker behind content. One height field drives points + ridge lines.
const FIELD = `
uniform float uTime,uPhase,uPulse;
float H(vec2 p){
  float a=sin(p.x*.13+p.y*.17+uTime*.12+uPhase)*2.2, b=cos(p.x*.27-p.y*.09-uTime*.09+uPhase*1.3)*1.05, c=sin(p.y*.31+uTime*.07+uPhase*.6)*.6, d=sin(p.x*.62+p.y*.5+uTime*.2)*.12;
  float r=length(p-vec2(0.,-3.)); float rip=sin(r*1.1-uPulse*7.)*exp(-uPulse*1.1-r*.07)*step(uPulse,5.)*.9;
  return a+b+c+d+rip;
}
float E(vec2 p){
  float crest=pow(.5+.5*sin(p.x*.13+p.y*.17+uTime*.12+uPhase+.6*cos(p.x*.27-p.y*.09)),10.);
  float sec=pow(.5+.5*cos(p.x*.27-p.y*.09-uTime*.09+uPhase*1.3),8.);
  float far=pow(.5+.5*sin(p.x*.05-p.y*.11+uPhase*.7),6.);
  return .1+crest*.95+sec*.28+far*.25;
}`
const MASK = `uniform vec2 uRes; float mask(){ vec2 uv=gl_FragCoord.xy/uRes; float yb=1.-uv.y; float band=smoothstep(.22,.0,yb)*.5+smoothstep(.6,.95,yb); return .08+.45*clamp(band,0.,1.); }`
export function startTerrain(canvas: HTMLCanvasElement) {
  const mobile = innerWidth < 800, still = matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5)); renderer.setSize(innerWidth, innerHeight, false)
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04070b)
  const cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200); cam.position.set(0, 6, 8); cam.lookAt(0, 0, 0)
  const U = { uTime: { value: 0 }, uPhase: { value: 0 }, uPulse: { value: 99 }, uPR: { value: renderer.getPixelRatio() }, uRes: { value: new THREE.Vector2() } }
  const cols = mobile ? 150 : 270, rows = mobile ? 90 : 150, pos: number[] = []
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pos.push((i / cols - 0.5) * 78, 0, 8 - (j / rows) * 42)
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const pts = new THREE.Points(pg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `${FIELD} uniform float uPR; varying float vE,vD; void main(){ vec3 p=position; p.y=H(p.xz); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; vE=E(position.xz); vD=-mv.z; gl_PointSize=uPR*(1.1+vE*2.2)*clamp(30./max(8.,vD),.55,1.5); }`,
    fragmentShader: `${MASK} varying float vE,vD; void main(){ float d=length(gl_PointCoord-vec2(.5))*2.; float core=1.-smoothstep(.1,.6,d), halo=exp(-d*4.5)*.35; float a=(core*.9+halo*.4)*mask()*(1.-smoothstep(26.,42.,vD))*clamp(.3+vE,0.,1.4)*.75; vec3 c=mix(vec3(.28,.42,.6),vec3(.92,.96,1.),clamp(vE,0.,1.)); gl_FragColor=vec4(c*(.7+vE*.5),a); }`
  }))
  pts.frustumCulled = false; scene.add(pts)
  const lineMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `${FIELD} varying float vE,vD; void main(){ vec3 p=position; p.y=H(p.xz); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; vE=E(position.xz); vD=-mv.z; }`,
    fragmentShader: `${MASK} varying float vE,vD; void main(){ float a=pow(clamp(vE,0.,1.),2.6)*.65*mask()*(1.-smoothstep(24.,40.,vD)); gl_FragColor=vec4(vec3(.85,.93,1.)*a,a); }`
  })
  for (let j = 0; j < (mobile ? 9 : 16); j++) {
    const lp: number[] = [], z = 7 - j * 2.3; for (let i = 0; i <= 420; i++) lp.push((i / 420 - 0.5) * 78, 0, z)
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); const l = new THREE.Line(lg, lineMat); l.frustumCulled = false; scene.add(l)
  }
  const comp = new EffectComposer(renderer); comp.addPass(new RenderPass(scene, cam)); comp.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.35)); comp.addPass(new OutputPass())
  const size = () => { renderer.setSize(innerWidth, innerHeight, false); comp.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); renderer.getDrawingBufferSize(U.uRes.value) }
  addEventListener('resize', size); size()
  let target = 0, last = performance.now()
  const loop = (n: number) => {
    requestAnimationFrame(loop); const dt = Math.min(0.05, (n - last) / 1000); last = n; if (document.hidden) return
    if (!still) U.uTime.value += dt; U.uPulse.value += dt; U.uPhase.value += (target - U.uPhase.value) * (1 - Math.exp(-dt * 1.6)); comp.render()
  }
  requestAnimationFrame(loop)
  return { setPage(i: number, jump = false) { target = i * 2.1; if (jump) U.uPhase.value = target }, ripple() { U.uPulse.value = 0 } }
}
