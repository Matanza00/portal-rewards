/* ======================================================================
   2. Scene: the Gate (a machined ring with chevrons and a living event horizon), stars, hyperspace streaks, the coin
   ====================================================================== */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const canvas = $("#gl"), lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), easeIn = (k) => k * k * k, easeOut = (k) => 1 - Math.pow(1 - k, 3);
const state = { page: "home", pointer: { x: 0, y: 0, tx: 0, ty: 0 }, flip: 0, flipV: 0, spin: 0, spinV: 0, sound: false, colorway: "onyx", introT: 0, webgl: false, scrollV: 0, drag: null };
const warp = { on: false, t: 0, to: null, color: new THREE.Color("#3ad0ff"), swapped: false };
const SIDE_COLOR = { consumer: "#3ad0ff", brand: "#c04dff", home: "#9a6bff" };
const mobile = innerWidth < 700;
let renderer, composer, bloomPass, scene, camera, coin, gate, stars, streaks, envMap, textures, faceURL, coinScaleTarget = 1;
const coinPos = new THREE.Vector3(0, 0, 0), coinTarget = new THREE.Vector3(0, 0, 0), portalPos = new THREE.Vector3(0, 0, -0.45);
let ringAlpha = 1, portalScale = 1, bloomOK = false, streakAlpha = 0, streakSpeed = 0, time = 0;
const CAMZ = 6, FOV = 32, FRAME_R = 3.05, GATE_R = 2.26, NCHEV = 9;
const G = { tint: new THREE.Color("#3ad0ff"), tintAmt: 0, tintTarget: 0, ripT: -10, ripA: 0, dialT: 0, open: 0, opened: false, warpAmt: 0 };
const tmpC = new THREE.Color();
function worldPerPx() { return (2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * CAMZ) / innerHeight; }

const HORIZON_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HORIZON_FS = `uniform float uTime, uOpen, uWarp, uRipT, uRipA, uTintAmt, uAlpha; uniform vec3 uTint; uniform vec2 uLens; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; } return v; }
vec3 pal(float t){ vec3 a = vec3(0.03, 0.01, 0.10), b = vec3(0.36, 0.12, 0.95), c = vec3(0.98, 0.18, 0.70), d = vec3(0.20, 0.85, 1.0);
  vec3 s = t < 0.45 ? mix(a, b, t / 0.45) : (t < 0.75 ? mix(b, c, (t - 0.45) / 0.3) : mix(c, d, (t - 0.75) / 0.25)); return pow(s, vec3(2.2)); }
void main(){
  vec2 p = vUv * 2.0 - 1.0; p -= uLens * 0.06 * (1.0 - dot(p, p));
  float r = length(p), a = atan(p.y, p.x);
  float op = clamp(uOpen, 0.0, 1.0), ob = 1.0 + 2.9 * pow(op - 1.0, 3.0) + 1.9 * pow(op - 1.0, 2.0);
  float R = max(ob, 0.001); if (r > R) discard;
  float rn = r / R, spd = 1.0 + uWarp * 5.0, lr = log(max(rn, 0.002));
  float sw = a + lr * 1.8 - uTime * 0.4 * spd;
  vec2 q = vec2(cos(sw), sin(sw)) * (1.2 + rn) + vec2(lr * 0.6 - uTime * 0.15 * spd, 0.0);
  float n = fbm(q * 1.8 + vec2(fbm(q * 2.7 + uTime * 0.1), fbm(q * 2.3 - uTime * 0.12)) * 1.6);
  float caus = pow(1.0 - abs(sin(n * 9.0 + rn * 4.0 - uTime * 1.2 * spd)), 16.0);
  float age = uTime - uRipT;
  float rip = uRipA * sin(rn * 36.0 - age * 16.0) * exp(-age * 1.6) * exp(-abs(rn - age * 0.85) * 7.0);
  vec2 sg = vec2(sw * 5.0, lr * 7.0 + uTime * 1.4 * spd); vec2 id = floor(sg), fp = fract(sg) - 0.5; float h = hash(id);
  float star = step(0.9, h) * smoothstep(0.14, 0.0, length(fp)) * (0.6 + 0.4 * sin(uTime * 4.0 + h * 50.0)) * smoothstep(0.05, 0.4, rn);
  float t = clamp(n * 1.25 - 0.12 + caus * 0.25 + rip * 0.5 + (1.0 - rn) * 0.12, 0.0, 1.0);
  vec3 col = pal(t);
  col = mix(col, uTint * (0.08 + t * t), uTintAmt * 0.6);
  col += caus * mix(vec3(0.35, 0.8, 1.0), uTint, uTintAmt * 0.5) * 0.75;
  col += abs(rip) * vec3(0.7, 0.9, 1.0) * 0.6;
  col *= mix(0.4, 1.0, smoothstep(0.1, 0.85, rn));
  float core = exp(-rn * rn * 32.0);
  col += mix(vec3(1.0, 0.7, 1.0), uTint, uTintAmt * 0.4) * core * (0.6 + 0.2 * sin(uTime * 2.3)) * (1.0 + uWarp * 3.0);
  col += star * vec3(0.85, 0.95, 1.0) * 1.6;
  col += smoothstep(0.84, 1.0, rn) * vec3(0.1, 0.55, 1.0) * (0.5 + 0.35 * sin(a * 14.0 + uTime * 5.0));
  col += smoothstep(0.95, 1.0, rn) * vec3(1.0, 0.25, 0.85) * 0.7;
  col *= 1.0 + uWarp * 1.5;
  gl_FragColor = vec4(col, smoothstep(1.0, 0.975, rn) * uAlpha * smoothstep(0.0, 0.15, op));
}`;

function canvasTex(w, h, draw, srgb = true) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// a ring with polar UVs (u runs round the ring, v from inner to outer edge), so textures wrap like a band
function polarRing(r0, r1, seg = 256, t0 = 0, tl = Math.PI * 2, flipU = false) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const a = t0 + (i / seg) * tl, c = Math.cos(a), s = Math.sin(a), u = flipU ? 1 - i / seg : i / seg; pos.push(c * r0, s * r0, 0, c * r1, s * r1, 0); uv.push(u, 0, u, 1); if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
const basic = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide, ...o });
const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const radial = () => canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); });

function buildGate() {
  const g = new THREE.Group(), U = {}, glowTex = radial();
  // light spill behind the gate
  U.glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), basic({ map: glowTex, color: hot("#7a2cff", 0.35), blending: THREE.AdditiveBlending })); U.glow.position.z = -0.5; g.add(U.glow);
  // the event horizon
  U.hmat = new THREE.ShaderMaterial({ vertexShader: HORIZON_VS, fragmentShader: HORIZON_FS.replace(/OCT/g, mobile ? "3" : "4"), transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uWarp: { value: 0 }, uRipT: { value: -10 }, uRipA: { value: 0 }, uTintAmt: { value: 0 }, uAlpha: { value: 1 }, uTint: { value: new THREE.Color("#3ad0ff") }, uLens: { value: new THREE.Vector2() } } });
  U.horizon = new THREE.Mesh(new THREE.CircleGeometry(GATE_R, 160), U.hmat); g.add(U.horizon);
  // the machined frame: a lathed profile with an inner bevel, a flat face and an outer bevel
  U.frameMat = new THREE.MeshStandardMaterial({ color: "#3b3752", metalness: 0.92, roughness: 0.3, envMap, envMapIntensity: 1.3, side: THREE.DoubleSide, transparent: true });
  const prof = [[2.24, -0.16], [2.27, 0.04], [2.36, 0.15], [2.5, 0.2], [2.86, 0.2], [2.96, 0.13], [3.05, -0.16]].map(([r, z]) => new THREE.Vector2(r, z));
  const frame = new THREE.Mesh(new THREE.LatheGeometry(prof, 256), U.frameMat); frame.rotation.x = Math.PI / 2; g.add(frame);
  U.grooveMat = basic({ color: "#08070e", opacity: 0.9 });
  for (const [a, b] of [[2.505, 2.52], [2.835, 2.848]]) { const m = new THREE.Mesh(polarRing(a, b, 256), U.grooveMat); m.position.z = 0.201; g.add(m); }
  // the rune band, engraved and glowing, slowly turning
  const words = "PORTAL REWARDS  ✦  SCAN  ✦  EARN  ✦  OWN THE RELATIONSHIP  ✦  01 00 11 01  ✦  ";
  const glyphTex = canvasTex(4096, 80, (c, w, h) => { c.fillStyle = "#fff"; c.font = '500 38px "DM Mono", ui-monospace, monospace'; c.textBaseline = "middle"; const tw = c.measureText(words).width, n = Math.max(1, Math.round(w / tw)), sx = w / (tw * n); c.save(); c.scale(sx, 1); for (let i = 0; i < n; i++) c.fillText(words, i * tw, h / 2 + 2); c.restore(); for (let x = 0; x < w; x += 24) { c.fillRect(x, 0, 2, x % 192 === 0 ? 14 : 7); c.fillRect(x, h - (x % 192 === 0 ? 14 : 7), 2, 14); } });
  U.band = new THREE.Mesh(polarRing(2.53, 2.82, 512, 0, Math.PI * 2, true), basic({ map: glyphTex, color: hot("#5fe3ff", 1.5), opacity: 0.85, blending: THREE.AdditiveBlending })); U.band.position.z = 0.205; g.add(U.band);
  // the energised inner lip and a fine outer edge line
  U.lip = new THREE.Mesh(new THREE.TorusGeometry(GATE_R + 0.01, 0.028, 12, 256), basic({ color: hot("#c8f6ff", 2.4), opacity: 1 })); U.lip.position.z = 0.02; g.add(U.lip);
  U.edge = new THREE.Mesh(new THREE.TorusGeometry(3.04, 0.012, 8, 256), basic({ color: hot("#a07bff", 1.6) })); U.edge.position.z = -0.1; g.add(U.edge);
  // nine chevrons that lock one by one
  const cs = new THREE.Shape(); cs.moveTo(-0.24, 0.17); cs.lineTo(0.24, 0.17); cs.lineTo(0.11, -0.17); cs.lineTo(-0.11, -0.17); cs.closePath();
  const chevGeo = new THREE.ExtrudeGeometry(cs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  const ls = new THREE.Shape(); ls.moveTo(-0.14, 0.1); ls.lineTo(0.14, 0.1); ls.lineTo(0.05, -0.1); ls.lineTo(-0.05, -0.1); ls.closePath();
  const litGeo = new THREE.ShapeGeometry(ls), chevMat = new THREE.MeshStandardMaterial({ color: "#56506f", metalness: 0.9, roughness: 0.28, envMap, envMapIntensity: 1.4, transparent: true });
  U.chevMat = chevMat; U.chev = [];
  for (let i = 0; i < NCHEV; i++) {
    const a = Math.PI / 2 - (i / NCHEV) * Math.PI * 2, cg = new THREE.Group(); cg.position.set(Math.cos(a) * 2.93, Math.sin(a) * 2.93, 0.18); cg.rotation.z = a - Math.PI / 2;
    const body = new THREE.Mesh(chevGeo, chevMat), lit = new THREE.Mesh(litGeo, basic({ color: "#000" })); lit.position.z = 0.135;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), basic({ map: glowTex, color: "#000", blending: THREE.AdditiveBlending })); halo.position.z = 0.14;
    cg.add(body, lit, halo); g.add(cg); U.chev.push({ lit, halo, col: new THREE.Color().setHSL(0.52 + (i / (NCHEV - 1)) * 0.36, 1, 0.58), litAt: -1 });
  }
  // HUD arcs outside the frame, each turning at its own speed
  const tickTex = canvasTex(2048, 32, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, h / 2 - 1, w, 2); for (let x = 0; x < w; x += 16) { const big = x % 128 === 0; c.fillRect(x, big ? 0 : h / 2 - 6, 2, big ? h : 12); } });
  const dashTex = canvasTex(2048, 8, (c, w, h) => { c.fillStyle = "#fff"; for (let x = 0; x < w; x += 48) c.fillRect(x, 0, 30, h); });
  const arc = (r0, r1, t0, tl, map, col, speed) => { const m = new THREE.Mesh(polarRing(r0, r1, 256, t0, tl), basic({ map, color: hot(col, 1.4), opacity: 0.75, blending: THREE.AdditiveBlending })); m.position.z = 0.05; m.userData.speed = speed; for (const t of [t0, t0 + tl]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), basic({ color: hot(col, 2) })); d.position.set(Math.cos(t) * (r0 + r1) / 2, Math.sin(t) * (r0 + r1) / 2, 0.01); m.add(d); } g.add(m); return m; };
  U.hud = [arc(3.2, 3.3, 0, Math.PI * 1.35, tickTex, "#43e0ff", 0.12), arc(3.42, 3.45, 0.4, Math.PI * 1.7, dashTex, "#c04dff", -0.08), arc(3.6, 3.615, 1.2, Math.PI * 0.9, null, "#ff4fd8", 0.18), arc(3.76, 3.77, Math.PI, Math.PI * 0.6, null, "#43e0ff", -0.05)];
  // sparks flung off the rim
  const NS = mobile ? 140 : 320, sg = new THREE.BufferGeometry();
  U.sp = { n: NS, pos: new Float32Array(NS * 3), col: new Float32Array(NS * 3), base: new Float32Array(NS * 3), vel: new Float32Array(NS * 3), life: new Float32Array(NS), max: new Float32Array(NS).fill(1), acc: 0 };
  for (let i = 0; i < NS; i++) U.sp.pos[i * 3 + 2] = -50;
  sg.setAttribute("position", new THREE.BufferAttribute(U.sp.pos, 3)); sg.setAttribute("color", new THREE.BufferAttribute(U.sp.col, 3));
  U.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.11, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })); g.add(U.sparks);
  // lightning that crackles along the rim
  U.bolts = []; for (let b = 0; b < 3; b++) { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(32 * 3), 3)); const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: hot("#d9f6ff", 3), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, fog: false })); line.position.z = 0.06; g.add(line); U.bolts.push({ line, t: 0, next: 0.6 + Math.random() * 1.5 }); }
  // the shock ring when the horizon bursts open or the coin is tapped
  U.burst = new THREE.Mesh(new THREE.TorusGeometry(GATE_R, 0.07, 12, 200), basic({ color: hot("#ffffff", 2.2), opacity: 0, blending: THREE.AdditiveBlending })); U.burst.userData.t = 1; g.add(U.burst);
  // the horizon lights the frame and the edge of the coin
  U.light = new THREE.PointLight("#9a6bff", 6, 0, 2); U.light.position.set(0, 0, -0.1); g.add(U.light);
  g.userData = U; return g;
}
const SPARK_COLS = ["#ffffff", "#5fe3ff", "#ff4fd8", "#b48cff"].map((h) => new THREE.Color(h));
function emitSpark(U, i, power = 1) {
  const s = U.sp, th = Math.random() * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), r = GATE_R + 0.03, sp = (0.9 + Math.random() * 1.9) * power, ro = (0.3 + Math.random() * 0.9) * power;
  s.pos[i * 3] = c * r; s.pos[i * 3 + 1] = sn * r; s.pos[i * 3 + 2] = 0.08;
  s.vel[i * 3] = -sn * sp + c * ro; s.vel[i * 3 + 1] = c * sp + sn * ro; s.vel[i * 3 + 2] = Math.random() * 0.5;
  s.max[i] = s.life[i] = 0.5 + Math.random() * 0.9; tmpC.copy(SPARK_COLS[(Math.random() * SPARK_COLS.length) | 0]).lerp(G.tint, G.tintAmt * 0.6).multiplyScalar(1.8); s.base[i * 3] = tmpC.r; s.base[i * 3 + 1] = tmpC.g; s.base[i * 3 + 2] = tmpC.b;
}
function sparkBurst(n) { const U = gate?.userData; if (!U) return; let made = 0; for (let i = 0; i < U.sp.n && made < n; i++) if (U.sp.life[i] <= 0) { emitSpark(U, i, 1.8); made++; } }
function zap(b) {
  const a = b.line.geometry.attributes.position, a0 = Math.random() * Math.PI * 2, span = 0.2 + Math.random() * 0.4; let r = GATE_R + 0.02;
  for (let i = 0; i < 32; i++) { const t = a0 + span * (i / 31); r = i === 0 || i === 31 ? GATE_R + 0.02 : clamp(r + (Math.random() - 0.5) * 0.09, GATE_R - 0.06, GATE_R + 0.22); a.setXYZ(i, Math.cos(t) * r, Math.sin(t) * r, 0); }
  a.needsUpdate = true; b.t = 0.13; window.__sfx?.zap();
}
function dial() { G.dialT = 0; G.open = 0; G.opened = false; gate?.userData.chev.forEach((c) => (c.litAt = -1)); }
function ripple() { G.ripT = time; G.ripA = 1; const b = gate?.userData.burst; if (b) b.userData.t = 0; sparkBurst(40); }
window.__gate = { tint(hex) { if (warp.on) return; if (hex) { G.tint.set(hex); G.tintTarget = 1; } else G.tintTarget = 0; }, ripple, dial };

function updateGate(dt, vis, k) {
  const U = gate.userData;
  // dial-in: each chevron locks with a click, then the horizon bursts open
  G.dialT += dt;
  U.chev.forEach((c, i) => { if (c.litAt < 0 && G.dialT >= 0.25 + i * 0.12) { c.litAt = time; window.__sfx?.dial(); } });
  if (!G.opened && G.dialT >= 0.25 + NCHEV * 0.12 + 0.1) { G.opened = true; U.burst.userData.t = 0; sparkBurst(90); window.__sfx?.kawoosh(); }
  if (G.opened || (warp.on && !warp.swapped)) G.open = Math.min(1, G.open + dt / (warp.on ? 0.25 : 0.6));
  G.tintAmt = lerp(G.tintAmt, G.tintTarget, 0.07);
  const hu = U.hmat.uniforms; hu.uTime.value = time; hu.uOpen.value = G.open; hu.uWarp.value = k; hu.uRipT.value = G.ripT; hu.uRipA.value = G.ripA; hu.uTintAmt.value = G.tintAmt; hu.uTint.value.copy(G.tint); hu.uAlpha.value = vis; hu.uLens.value.set(state.pointer.x, state.pointer.y);
  U.frameMat.opacity = vis; U.chevMat.opacity = vis; U.grooveMat.opacity = 0.9 * vis;
  U.chev.forEach((c, i) => { const lit = c.litAt >= 0, flash = lit ? Math.exp(-(time - c.litAt) * 3.5) : 0, wave = 0.7 + 0.3 * Math.sin(time * 2.2 - i * 0.7), lvl = lit ? wave + flash * 2.2 + k * 2 : 0.08;
    tmpC.copy(c.col).lerp(G.tint, G.tintAmt); c.lit.material.color.copy(tmpC).multiplyScalar(lvl * 2.2); c.lit.material.opacity = vis; c.halo.material.color.copy(tmpC).multiplyScalar(lit ? (0.35 + flash * 1.4 + k) : 0); c.halo.material.opacity = vis; });
  U.band.rotation.z -= dt * (0.03 + k * 0.5); U.band.material.opacity = 0.85 * vis;
  U.lip.material.opacity = vis * (0.4 + 0.6 * G.open); U.lip.material.color.copy(tmpC.set("#c8f6ff").lerp(G.tint, G.tintAmt * 0.5)).multiplyScalar(2.4 + k * 3);
  U.edge.material.opacity = vis;
  U.hud.forEach((m) => { m.rotation.z += m.userData.speed * dt * (1 + k * 10); m.material.opacity = 0.75 * vis; m.children.forEach((d) => (d.material.opacity = vis)); });
  tmpC.set("#7a2cff").lerp(G.tint, G.tintAmt); U.glow.material.color.copy(tmpC).multiplyScalar((0.32 + 0.08 * Math.sin(time * 1.3)) * (1 + k * 3)); U.glow.material.opacity = vis * G.open;
  U.light.color.copy(tmpC); U.light.intensity = 6 * vis * (0.3 + 0.7 * G.open) * (1 + k * 3);
  // burst ring
  const bu = U.burst; if (bu.userData.t < 1) { bu.userData.t = Math.min(1, bu.userData.t + dt / 0.8); const e = easeOut(bu.userData.t); bu.scale.setScalar(1 + e * 0.5); bu.material.opacity = (1 - bu.userData.t) * vis; } else bu.material.opacity = 0;
  if (G.ripA > 0) G.ripA = Math.max(0, G.ripA - dt * 0.4);
  // sparks: a steady stream, more while warping
  const s = U.sp; s.acc += dt * (mobile ? 40 : 90) * G.open * vis * (1 + k * 4);
  for (let i = 0; i < s.n && s.acc >= 1; i++) if (s.life[i] <= 0) { emitSpark(U, i); s.acc -= 1; }
  s.acc = Math.min(s.acc, 5);
  for (let i = 0; i < s.n; i++) { if (s.life[i] <= 0) { s.col[i * 3] = s.col[i * 3 + 1] = s.col[i * 3 + 2] = 0; continue; } s.life[i] -= dt; const f = Math.max(0, s.life[i] / s.max[i]), d = Math.pow(0.965, dt * 60);
    for (let j = 0; j < 3; j++) { s.vel[i * 3 + j] *= d; s.pos[i * 3 + j] += s.vel[i * 3 + j] * dt; s.col[i * 3 + j] = s.base[i * 3 + j] * f * vis; } }
  U.sparks.geometry.attributes.position.needsUpdate = true; U.sparks.geometry.attributes.color.needsUpdate = true;
  // lightning
  U.bolts.forEach((b) => { if (b.t > 0) { b.t -= dt; b.line.material.opacity = (Math.random() > 0.3 ? 1 : 0.35) * vis; if (b.t <= 0) b.line.material.opacity = 0; } else { b.next -= dt; if (b.next <= 0 && G.open > 0.9 && vis > 0.3) { zap(b); b.next = k > 0 ? 0.05 + Math.random() * 0.2 : 0.5 + Math.random() * 1.6; } } });
}

// hyperspace streaks for the trip through the portal
function buildStreaks() {
  const N = mobile ? 260 : 600, pos = new Float32Array(N * 6), col = new Float32Array(N * 6), seed = new Float32Array(N), cols = ["#5fe3ff", "#b48cff", "#ff4fd8", "#ffffff"].map((h) => new THREE.Color(h).multiplyScalar(1.6));
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 4.5, z = -5 - Math.random() * 45; pos.set([Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(a) * r, Math.sin(a) * r, z - 0.1], i * 6); const c = cols[i % cols.length]; col.set([c.r, c.g, c.b, c.r * 0.1, c.g * 0.1, c.b * 0.1], i * 6); seed[i] = 0.6 + Math.random() * 0.8; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, fog: false })); m.userData.seed = seed; m.frustumCulled = false; return m;
}
function updateStreaks(dt) {
  streaks.material.opacity = streakAlpha; streaks.visible = streakAlpha > 0.01; if (!streaks.visible) return;
  const a = streaks.geometry.attributes.position, seed = streaks.userData.seed, camz = camera.position.z, len = 0.08 + streakSpeed * 0.012;
  for (let i = 0; i < seed.length; i++) { let z = a.getZ(i * 2) + streakSpeed * seed[i] * dt; if (z > camz - 0.5) { const ang = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 4.5; z = camz - 30 - Math.random() * 25; a.setXY(i * 2, Math.cos(ang) * r, Math.sin(ang) * r); a.setXY(i * 2 + 1, Math.cos(ang) * r, Math.sin(ang) * r); } a.setZ(i * 2, z); a.setZ(i * 2 + 1, z - len * seed[i]); }
  a.needsUpdate = true;
}

function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.6)); renderer.setSize(innerWidth, innerHeight, false); renderer.setClearColor("#07060b", 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog("#07060b", 9, 30);
  camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 120); camera.position.set(0, 0, CAMZ);
  const pm = new THREE.PMREMGenerator(renderer); envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.add(new THREE.AmbientLight("#8e8cf6", 0.35));
  const key = new THREE.DirectionalLight("#ffffff", 2.2); key.position.set(2, 3, 5); scene.add(key);
  const fillC = new THREE.DirectionalLight("#3ad0ff", 1.4); fillC.position.set(-4, -1, 3); scene.add(fillC);
  const fillV = new THREE.DirectionalLight("#ff4fd8", 1.2); fillV.position.set(4, -2, 2); scene.add(fillV);
  textures = makeCoinTextures(mobile ? 1024 : 1536, PALETTES.onyx); coin = makeCoin(textures, PALETTES.onyx, envMap); scene.add(coin);
  gate = buildGate(); scene.add(gate);
  const r1 = rng(21), N = mobile ? 800 : 1700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = r1() * Math.PI * 2, rad = 0.6 + Math.pow(r1(), 0.6) * 7; pos[i * 3] = Math.cos(a) * rad; pos[i * 3 + 1] = Math.sin(a) * rad * 0.8; pos[i * 3 + 2] = -1 - r1() * 5; const cy = r1() > 0.7; col[i * 3] = cy ? 0.35 : 0.6; col[i * 3 + 1] = cy ? 0.85 : 0.45; col[i * 3 + 2] = 1; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.05, map: radial(), vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(stars);
  streaks = buildStreaks(); scene.add(streaks);
  try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / (mobile ? 2 : 1), innerHeight / (mobile ? 2 : 1)), 0.55, 0.45, 0.85); composer.addPass(bloomPass); composer.addPass(new OutputPass()); bloomOK = true; } catch (e) { console.warn("bloom off", e); bloomOK = false; }
  state.webgl = true;
}
function resize() { if (!renderer) return; renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); composer?.setSize(innerWidth, innerHeight); }

// the slot of the active page nearest the viewport centre
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
  const rpx = innerWidth < 700 ? (hr && slot ? slot.r.width / 2 : innerWidth * 0.47) : Math.min(innerHeight * 0.38, innerWidth * 0.42);
  portalScale = (rpx * wpp) / FRAME_R;
  if (hr && slot && !warp.on) { portalPos.x = coinTarget.x; portalPos.y = coinTarget.y; }
}
function openPortal(to) {
  if (warp.on) return; if (!state.webgl) { window.__showPage?.(to); return; }
  warp.on = true; warp.t = 0; warp.to = to; warp.swapped = false; warp.color.set(SIDE_COLOR[to] || SIDE_COLOR.home);
  G.tint.copy(warp.color); G.tintTarget = 1;
  if (ringAlpha < 0.5) { portalPos.set(0, 0, -0.45); G.open = 0; G.opened = true; G.dialT = 9; gate.userData.chev.forEach((c) => (c.litAt = time)); }
  document.body.classList.add("warp"); $("#hudtxt").textContent = to === "home" ? "Returning to the portal" : `Entering the ${to === "brand" ? "brands" : "consumer"} portal`; $("#hud").classList.add("on");
  window.__sfx?.portal(); window.__discover?.("portal");
}
window.__openPortal = openPortal;
let last = 0;
function frame(now) {
  requestAnimationFrame(frame); if (!renderer || document.hidden) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; time += dt;
  const p = state.pointer; p.x = lerp(p.x, p.tx, 0.08); p.y = lerp(p.y, p.ty, 0.08);
  updateTargets();
  state.introT = Math.min(1, state.introT + dt / 1.6); const it = easeOut(state.introT);
  // the trip: dive into the horizon, cross it, land; the camera always comes back to its resting place
  let k = 0;
  if (warp.on) {
    warp.t += dt / 1.9; const t = warp.t;
    if (!warp.swapped) {
      k = easeIn(clamp(t / 0.6, 0, 1));
      portalPos.x = lerp(portalPos.x, 0, 0.18); portalPos.y = lerp(portalPos.y, 0, 0.18);
      camera.position.z = CAMZ - (CAMZ + 2.4) * k; streakAlpha = clamp((k - 0.3) / 0.4, 0, 1); streakSpeed = 15 + k * 150;
      if (t >= 0.6) { warp.swapped = true; camera.position.z = CAMZ; const f = $("#flash"); f.style.setProperty("--fc", "#" + warp.color.getHexString()); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); $("#hud").classList.remove("on"); document.body.classList.remove("warp"); window.__showPage?.(warp.to); window.__sfx?.chime(); }
    } else {
      const land = 1 - clamp((t - 0.6) / 0.4, 0, 1);
      camera.position.z = CAMZ; streakAlpha = land; streakSpeed = 20 + 140 * land * land;
      if (t >= 1) { warp.on = false; G.tintTarget = 0; streakAlpha = 0; }
    }
  } else camera.position.z = CAMZ;
  const vis = warp.on && !warp.swapped ? 1 : ringAlpha * it;
  // the coin follows its slot; during the dive it is pulled into the horizon
  const pull = warp.on && !warp.swapped;
  coinPos.lerp(pull ? new THREE.Vector3(portalPos.x, portalPos.y, portalPos.z + 0.3) : coinTarget, pull ? 0.2 : 0.12);
  coin.position.copy(coinPos); coin.position.y += (1 - it) * 2.2 + Math.sin(time * 1.1) * 0.03;
  const sc = coinScaleTarget * (0.6 + 0.4 * it) * (pull ? 1 - k * 0.9 : 1); coin.scale.setScalar(lerp(coin.scale.x || sc, sc, 0.15));
  state.spinV *= 0.95; state.spin += dt * (0.55 + state.flipV * 0.4 + Math.abs(state.scrollV) * 0.004) + state.spinV * dt; state.scrollV *= 0.9;
  state.flipV *= 0.94; state.flip += state.flipV * dt; if (Math.abs(state.flipV) < 0.02) { const target = Math.round(state.flip / Math.PI) * Math.PI; state.flip = lerp(state.flip, target, 0.08); }
  coin.rotation.set(state.flip + p.y * -0.35, state.spin, p.x * 0.12);
  // the gate
  gate.visible = vis > 0.01; gate.position.copy(portalPos); gate.scale.setScalar(portalScale * (1 + k * 0.7)); gate.rotation.set(p.y * 0.1, p.x * -0.14, 0);
  if (gate.visible) updateGate(dt, vis, k);
  updateStreaks(dt);
  stars.rotation.z = time / 60; stars.position.set(p.x * -0.15, p.y * -0.1, 0); stars.material.opacity = 0.9 * (0.3 + 0.7 * ringAlpha) * (state.page === "home" ? 1 : 0.55);
  if (bloomOK && (vis > 0.02 || streakAlpha > 0.02)) { bloomPass.strength = 0.55 + k * 1.0; composer.render(); } else renderer.render(scene, camera);
}
