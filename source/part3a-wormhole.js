/* ======================================================================
   2. Scene: a wormhole that lenses a procedural sky (Einstein ring outside, another galaxy inside), the coin, the trip
   ====================================================================== */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const canvas = $("#gl"), lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), easeIn = (k) => k * k * k, easeOut = (k) => 1 - Math.pow(1 - k, 3);
const state = { page: "home", pointer: { x: 0, y: 0, tx: 0, ty: 0 }, flip: 0, flipV: 0, spin: 0, spinV: 0, sound: false, colorway: "onyx", introT: 0, webgl: false, scrollV: 0, drag: null };
const warp = { on: false, t: 0, to: null, color: new THREE.Color("#3ad0ff"), swapped: false };
const SIDE_COLOR = { consumer: "#8fdcff", brand: "#d9a8ff", home: "#c9c2ff" };
const mobile = innerWidth < 700;
let renderer, composer, bloomPass, scene, camera, coin, sky, stars, streaks, envMap, textures, faceURL, coinScaleTarget = 1;
const coinPos = new THREE.Vector3(0, 0, 0), coinTarget = new THREE.Vector3(0, 0, 0), portalPos = new THREE.Vector3(0, 0, 0);
let ringAlpha = 1, wormR = 200, bloomOK = false, streakAlpha = 0, streakSpeed = 0, time = 0;
const CAMZ = 6, FOV = 32;
// G keeps the wormhole's state; the names match what the page script calls (tint, ripple, dial = "form again")
const G = { tint: new THREE.Color("#8fdcff"), tintAmt: 0, tintTarget: 0, pulseT: -10, pulseA: 0, open: 0, forming: true, warpAmt: 0, center: new THREE.Vector2(), sky: new THREE.Vector2() };
function worldPerPx() { return (2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * CAMZ) / innerHeight; }

const SKY_VS = `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `precision highp float;
uniform vec2 uRes, uC, uSky; uniform float uR, uTime, uAlpha, uOpen, uWarp, uSpin, uPulseT, uPulseA, uTintAmt; uniform vec3 uTint;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
// one star per grid cell (with probability prob), about a pixel wide at 1:1 magnification
vec3 stars(vec2 p, float sc, float prob, float seed, float floorB){
  vec2 g = p * sc, id = floor(g), f = fract(g); float h = hash(id + seed);
  if (h > prob) return vec3(0.0);
  vec2 o = vec2(hash(id + seed + 1.7), hash(id + seed + 4.3)) * 0.8 + 0.1;
  float w = 1.15 * sc / uRes.y, d = length(f - o) / w;
  float b = pow(hash(id + seed + 8.1), 9.0) * 2.4 + floorB, tw = 0.82 + 0.18 * sin(uTime * (0.7 + h * 3.0) + h * 60.0);
  vec3 tc = mix(vec3(0.68, 0.78, 1.0), vec3(1.0, 0.84, 0.66), hash(id + seed + 2.9));
  return tc * b * tw * exp(-d * d);
}
// this side: dark sky, faint dust and gas, three layers of stars
vec3 skyA(vec2 p){
  float n = fbm(p * 1.3 + 3.0), m = fbm(p * 2.6 + 11.0);
  vec3 c = vec3(0.0025, 0.0025, 0.008) + pow(n, 3.2) * vec3(0.05, 0.025, 0.11) + pow(m, 5.0) * vec3(0.0, 0.06, 0.085);
  return c + stars(p, 70.0, 0.3, 0.0, 0.016) + stars(p, 160.0, 0.2, 11.0, 0.005) + stars(p, 28.0, 0.2, 23.0, 0.04) * 1.3;
}
// the other side: a tilted spiral galaxy with dust lanes, in a denser, bluer field
vec3 skyB(vec2 o){
  vec2 g = vec2(o.x, o.y * 1.7); float r = length(g), a = atan(g.y, g.x) + uTime * 0.025;
  float arms = pow(0.5 + 0.5 * cos(2.0 * (a - 2.4 * log(r + 0.04))), 3.0);
  float dust = fbm(g * 3.2 + vec2(uTime * 0.01, 0.0)), disk = exp(-r * 3.0), core = exp(-r * r * 70.0);
  vec3 armCol = mix(vec3(0.30, 0.45, 1.0), vec3(0.75, 0.38, 1.0), dust); armCol = mix(armCol, uTint, uTintAmt * 0.45);
  vec3 c = vec3(0.003, 0.004, 0.015) + armCol * disk * arms * (0.35 + 0.9 * dust) * 0.9 + vec3(1.0, 0.82, 0.6) * (core * 2.0 + disk * 0.15);
  c *= 1.0 - 0.65 * smoothstep(0.5, 0.78, dust) * smoothstep(0.02, 0.25, r) * disk;
  return c + stars(o, 55.0, 0.4, 31.0, 0.02) * 1.2 + stars(o, 130.0, 0.25, 41.0, 0.008);
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main(){
  vec2 px = gl_FragCoord.xy, d = px - uC; float th = max(length(d), 0.001);
  float R = max(uR * uOpen, 0.5);
  // a gravitational wave rolling outward after a tap
  float age = uTime - uPulseT; d *= 1.0 + uPulseA * 0.025 * sin(th / R * 9.0 - age * 13.0) * exp(-age * 1.8) * exp(-abs(th / R - 1.0 - age * 1.3) * 1.6);
  th = max(length(d), 0.001); vec2 dir = d / th; float rn = th / R; vec3 col;
  vec2 toSky = 1.0 / vec2(uRes.y);
  if (rn > 1.0) {
    // thin-lens mapping: the sky behind is pulled into an Einstein ring; frame dragging twists it a little
    float thE = R * 0.98, beta = th - thE * thE / th;
    vec2 sdir = rot(uSpin * pow(R / th, 2.0)) * dir;
    col = skyA((uC + sdir * beta - 0.5 * uRes) * toSky + uSky);
    col += exp(-(rn - 1.0) * 5.0) * vec3(0.05, 0.06, 0.12) * uOpen;          // light piling up just outside the throat
  } else {
    // inside: the other universe seen through a sphere, with a squeezed mirror image of this side at the rim
    vec2 q = d / R; float qq = dot(q, q);
    vec2 o = rot(uTime * 0.02) * q / sqrt(max(1.0 - qq, 0.03)) * (0.5 / (1.0 + uWarp * 1.5));
    col = skyB(o);
    float edge = smoothstep(0.8, 1.0, rn);
    vec2 back = uC - dir * (R * (1.0 - rn) * 7.0 + R * 0.04);
    col = mix(col, skyA((back - 0.5 * uRes) * toSky + uSky) * 1.4, edge * 0.85);
  }
  col += exp(-pow((th - R) / (1.6 * uRes.y / 900.0), 2.0)) * vec3(0.75, 0.82, 1.0) * 0.45 * uOpen;   // a hair-thin photon ring
  col *= 1.0 + uWarp * 0.8;
  gl_FragColor = vec4(col, uAlpha);
}`;

// stretched starlight for the trip through the throat
function buildStreaks() {
  const N = mobile ? 260 : 600, pos = new Float32Array(N * 6), col = new Float32Array(N * 6), seed = new Float32Array(N), cols = ["#e6f0ff", "#ffffff", "#bcd0ff", "#ffe2c4"].map((h) => new THREE.Color(h).multiplyScalar(1.4));
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 4.5, z = -5 - Math.random() * 45; pos.set([Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(a) * r, Math.sin(a) * r, z - 0.1], i * 6); const c = cols[i % cols.length]; col.set([c.r, c.g, c.b, c.r * 0.08, c.g * 0.08, c.b * 0.08], i * 6); seed[i] = 0.6 + Math.random() * 0.8; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, fog: false })); m.userData.seed = seed; m.frustumCulled = false; return m;
}
function updateStreaks(dt) {
  streaks.material.opacity = streakAlpha; streaks.visible = streakAlpha > 0.01; if (!streaks.visible) return;
  const a = streaks.geometry.attributes.position, seed = streaks.userData.seed, camz = camera.position.z, len = 0.08 + streakSpeed * 0.012;
  for (let i = 0; i < seed.length; i++) { let z = a.getZ(i * 2) + streakSpeed * seed[i] * dt; if (z > camz - 0.5) { const ang = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 4.5; z = camz - 30 - Math.random() * 25; a.setXY(i * 2, Math.cos(ang) * r, Math.sin(ang) * r); a.setXY(i * 2 + 1, Math.cos(ang) * r, Math.sin(ang) * r); } a.setZ(i * 2, z); a.setZ(i * 2 + 1, z - len * seed[i]); }
  a.needsUpdate = true;
}
const radial = () => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };

function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.6)); renderer.setSize(innerWidth, innerHeight, false); renderer.setClearColor("#07060b", 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog("#07060b", 9, 30);
  camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 120); camera.position.set(0, 0, CAMZ); scene.add(camera);
  const pm = new THREE.PMREMGenerator(renderer); envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.add(new THREE.AmbientLight("#8e8cf6", 0.35));
  const key = new THREE.DirectionalLight("#ffffff", 2.2); key.position.set(2, 3, 5); scene.add(key);
  const fillC = new THREE.DirectionalLight("#9fd8ff", 1.2); fillC.position.set(-4, -1, 3); scene.add(fillC);
  const fillV = new THREE.DirectionalLight("#b9a2ff", 1.0); fillV.position.set(4, -2, 2); scene.add(fillV);
  textures = makeCoinTextures(mobile ? 1024 : 1536, PALETTES.onyx); coin = makeCoin(textures, PALETTES.onyx, envMap); scene.add(coin);
  // the sky with the wormhole: a full-screen plane carried by the camera, drawn first
  sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS.replace(/OCT/g, mobile ? "3" : "4"), transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uC: { value: new THREE.Vector2() }, uSky: { value: new THREE.Vector2() }, uR: { value: 100 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uOpen: { value: 0 }, uWarp: { value: 0 }, uSpin: { value: 0.35 }, uPulseT: { value: -10 }, uPulseA: { value: 0 }, uTintAmt: { value: 0 }, uTint: { value: new THREE.Color("#8fdcff") } } }));
  sky.renderOrder = -10; sky.position.z = -20; sky.frustumCulled = false; camera.add(sky);
  // the plain starfield for the other pages
  const r1 = rng(21), N = mobile ? 800 : 1700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = r1() * Math.PI * 2, rad = 0.6 + Math.pow(r1(), 0.6) * 7; pos[i * 3] = Math.cos(a) * rad; pos[i * 3 + 1] = Math.sin(a) * rad * 0.8; pos[i * 3 + 2] = -1 - r1() * 5; const cy = r1() > 0.7; col[i * 3] = cy ? 0.55 : 0.75; col[i * 3 + 1] = cy ? 0.8 : 0.72; col[i * 3 + 2] = 1; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.045, map: radial(), vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(stars);
  streaks = buildStreaks(); scene.add(streaks);
  try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / (mobile ? 2 : 1), innerHeight / (mobile ? 2 : 1)), 0.5, 0.4, 0.82); composer.addPass(bloomPass); composer.addPass(new OutputPass()); bloomOK = true; } catch (e) { console.warn("bloom off", e); bloomOK = false; }
  resizeSky(); state.webgl = true;
}
function resizeSky() { if (!sky) return; const h = 2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * 20; sky.scale.set(h * camera.aspect * 1.1, h * 1.1, 1); const b = renderer.getDrawingBufferSize(new THREE.Vector2()); sky.material.uniforms.uRes.value.copy(b); }
function resize() { if (!renderer) return; renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); composer?.setSize(innerWidth, innerHeight); resizeSky(); }

function dial() { G.open = 0; G.forming = true; window.__sfx?.kawoosh(); }
function ripple() { G.pulseT = time; G.pulseA = 1; }
window.__gate = { tint(hex) { if (warp.on) return; if (hex) { G.tint.set(hex); G.tintTarget = 1; } else G.tintTarget = 0; }, ripple, dial };

function activeSlot() {
  const slots = $$(`.page.on .coin-anchor`).filter((s) => s.offsetParent !== null); if (!slots.length) return null;
  let best = null, bd = 1e9; for (const s of slots) { const r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < bd) { bd = d; best = { el: s, r }; } }
  return best;
}
function updateTargets() {
  const slot = activeSlot(), wpp = worldPerPx();
  if (slot) { const { r, el } = slot; const cx = r.left + r.width / 2 - innerWidth / 2, cy = innerHeight / 2 - (r.top + r.height / 2); coinTarget.set(cx * wpp, cy * wpp, 0); const sz = innerWidth < 700 ? (+el.dataset.sizeM || +el.dataset.size || 1) : (+el.dataset.size || 1); coinScaleTarget = (Math.min(r.width, r.height) * wpp * 0.5) * sz; }
  const hero = $("#hero"), hr = hero && state.page === "home" ? hero.getBoundingClientRect() : null;
  ringAlpha = hr ? clamp(1 - (-hr.top) / (hr.height * 0.75), 0, 1) : 0;
  wormR = innerWidth < 700 ? (hr && slot ? slot.r.width * 0.41 : innerWidth * 0.4) : Math.min(innerHeight * 0.29, innerWidth * 0.3);
  if (hr && slot && !warp.on) G.center.set(slot.r.left + slot.r.width / 2, slot.r.top + slot.r.height / 2);   // CSS pixels from the top left
}
function openPortal(to) {
  if (warp.on) return; if (!state.webgl) { window.__showPage?.(to); return; }
  warp.on = true; warp.t = 0; warp.to = to; warp.swapped = false; warp.color.set(SIDE_COLOR[to] || SIDE_COLOR.home);
  G.tint.set(to === "brand" ? "#d08cff" : "#8fdcff"); G.tintTarget = 1;
  if (ringAlpha < 0.5) { G.center.set(innerWidth / 2, innerHeight / 2); G.open = 0; G.forming = true; }
  document.body.classList.add("warp"); $("#hudtxt").textContent = to === "home" ? "Returning to the portal" : `Entering the ${to === "brand" ? "brands" : "consumer"} portal`; $("#hud").classList.add("on");
  window.__sfx?.portal(); window.__discover?.("portal");
}
window.__openPortal = openPortal;
let last = 0;
function frame(now) {
  requestAnimationFrame(frame); if (!renderer || document.hidden) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; time += dt;
  const p = state.pointer; p.x = lerp(p.x, p.tx, 0.06); p.y = lerp(p.y, p.ty, 0.06);
  updateTargets();
  state.introT = Math.min(1, state.introT + dt / 1.6); const it = easeOut(state.introT);
  // the trip: the throat swells until the far galaxy fills the screen, starlight stretches, we land; the camera always returns
  let k = 0;
  if (warp.on) {
    warp.t += dt / 1.9; const t = warp.t;
    if (!warp.swapped) {
      k = easeIn(clamp(t / 0.6, 0, 1));
      G.center.lerp(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.12);
      camera.position.z = CAMZ - (CAMZ + 2.4) * k; streakAlpha = clamp((k - 0.35) / 0.4, 0, 1); streakSpeed = 15 + k * 150;
      if (t >= 0.6) { warp.swapped = true; camera.position.z = CAMZ; const f = $("#flash"); f.style.setProperty("--fc", "#" + warp.color.getHexString()); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); $("#hud").classList.remove("on"); document.body.classList.remove("warp"); window.__showPage?.(warp.to); window.__sfx?.chime(); }
    } else {
      const land = 1 - clamp((t - 0.6) / 0.4, 0, 1);
      camera.position.z = CAMZ; streakAlpha = land; streakSpeed = 20 + 140 * land * land;
      if (t >= 1) { warp.on = false; G.tintTarget = 0; streakAlpha = 0; }
    }
  } else camera.position.z = CAMZ;
  const vis = warp.on && !warp.swapped ? 1 : ringAlpha * it;
  // the coin follows its slot; during the dive it falls into the throat
  const pull = warp.on && !warp.swapped, wpp = worldPerPx();
  const throat = new THREE.Vector3((G.center.x - innerWidth / 2) * wpp, (innerHeight / 2 - G.center.y) * wpp, -0.3);
  coinPos.lerp(pull ? throat : coinTarget, pull ? 0.2 : 0.12);
  coin.position.copy(coinPos); coin.position.y += (1 - it) * 2.2 + Math.sin(time * 1.1) * 0.03;
  const sc = coinScaleTarget * (0.6 + 0.4 * it) * (pull ? 1 - k * 0.9 : 1);
  if (!coin.userData.placed) { coin.userData.placed = true; coin.scale.setScalar(sc); coinPos.copy(coinTarget); }
  coin.scale.setScalar(lerp(coin.scale.x, sc, 0.15));
  state.spinV *= 0.95; state.spin += dt * (0.55 + state.flipV * 0.4 + Math.abs(state.scrollV) * 0.004) + state.spinV * dt; state.scrollV *= 0.9;
  state.flipV *= 0.94; state.flip += state.flipV * dt; if (Math.abs(state.flipV) < 0.02) { const target = Math.round(state.flip / Math.PI) * Math.PI; state.flip = lerp(state.flip, target, 0.08); }
  coin.rotation.set(state.flip + p.y * -0.35, state.spin, p.x * 0.12);
  // the wormhole: it forms on arrival, breathes very slightly, and the sky behind drifts with the pointer
  sky.visible = vis > 0.01;
  if (sky.visible) {
    if (G.forming) { G.open = Math.min(1, G.open + dt / (warp.on ? 0.3 : 1.8)); if (G.open >= 1) G.forming = false; }
    G.tintAmt = lerp(G.tintAmt, G.tintTarget, 0.05); if (G.pulseA > 0) G.pulseA = Math.max(0, G.pulseA - dt * 0.35);
    G.sky.set(p.x * -0.06 + time * 0.004, p.y * -0.04);
    const u = sky.material.uniforms, pr = renderer.getPixelRatio(), open = easeOut(G.open), breathe = 1 + Math.sin(time * 0.7) * 0.008;
    u.uTime.value = time; u.uAlpha.value = vis; u.uOpen.value = open; u.uWarp.value = k; u.uR.value = wormR * pr * breathe * (1 + 9 * k * k);
    u.uC.value.set(G.center.x * pr, (innerHeight - G.center.y) * pr); u.uSky.value.copy(G.sky); u.uPulseT.value = G.pulseT; u.uPulseA.value = G.pulseA; u.uTint.value.copy(G.tint); u.uTintAmt.value = G.tintAmt;
  }
  updateStreaks(dt);
  stars.visible = vis < 0.99; stars.rotation.z = time / 60; stars.position.set(p.x * -0.15, p.y * -0.1, 0); stars.material.opacity = 0.75 * (1 - vis);
  if (bloomOK && (vis > 0.02 || streakAlpha > 0.02)) { bloomPass.strength = 0.5 + k * 0.8; composer.render(); } else renderer.render(scene, camera);
}
