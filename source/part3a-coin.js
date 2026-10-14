<script type="module">
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/* ======================================================================
   1. The coin: face textures drawn on canvas, geometry from primitives
   ====================================================================== */
const PALETTES = {
  onyx: { cyan: "#3cc8ff", violet: "#b070ff", lavender: "#8e8cf6", white: "#f5f5f8", black: "#0a0a0e", navy: "#0b0e1a", silver: "#e4e6ec", metal: "#e4e6ec" },
  amber: { cyan: "#ffd36b", violet: "#ff8a3d", lavender: "#ffb070", white: "#fff6e6", black: "#120d06", navy: "#160f08", silver: "#f0c76a", metal: "#e9b75a" },
  nova: { cyan: "#9be9ff", violet: "#c58cff", lavender: "#9a6bff", white: "#f6f0ff", black: "#0e0716", navy: "#120a20", silver: "#d9c4ff", metal: "#c9a8ff" },
};
const TEXT = { top: "PORTAL REWARDS", bottom: "SCAN TO EARN", qr: "https://portalrewards.com" };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
function arcText(c, text, cx, cy, radius, centerAngle, size, flip, spacing) {
  c.save(); c.font = `600 ${size}px "Hanken Grotesk", "Helvetica Neue", Arial, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  const widths = [...text].map((ch) => c.measureText(ch).width + size * spacing), total = widths.reduce((a, b) => a + b, 0), dir = flip ? -1 : 1;
  let ang = centerAngle - dir * (total / 2) / radius;
  [...text].forEach((ch, i) => { const w = widths[i], a = ang + dir * (w / 2) / radius; c.save(); c.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); c.rotate(a + dir * Math.PI / 2); c.fillText(ch, 0, 0); c.restore(); ang += dir * w / radius; });
  c.restore();
}
const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
let QR = null;
function qrModules() {
  if (QR) return QR;
  try { const q = window.qrcode(0, "M"); q.addData(TEXT.qr); q.make(); const n = q.getModuleCount(); QR = { n, at: (r, c) => q.isDark(r, c) }; }
  catch (e) { const rq = rng(11), n = 25, dark = (r, c) => { const f = (a, b) => (r >= a && r < a + 7 && c >= b && c < b + 7) ? ((r === a || r === a + 6 || c === b || c === b + 6) || (r >= a + 2 && r <= a + 4 && c >= b + 2 && c <= b + 4)) : null; const v = f(0, 0) ?? f(0, n - 7) ?? f(n - 7, 0); return v !== null ? v : rq() > 0.55; }; QR = { n, at: dark }; }
  return QR;
}
// one routine draws both the colour map and the height map ("h" paints grey levels = relief height)
function drawFace(c, S, mode, P) {
  const H = mode === "h", cx = S / 2, cy = S / 2, R = S / 2 * 0.985, g = (l) => `rgb(${l},${l},${l})`;
  const grad = () => { const gr = c.createLinearGradient(cx - R, cy + R * 0.6, cx + R, cy - R * 0.6); gr.addColorStop(0, P.cyan); gr.addColorStop(0.5, P.lavender); gr.addColorStop(1, P.violet); return gr; };
  c.fillStyle = H ? g(0) : "#000"; c.fillRect(0, 0, S, S);
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = H ? g(40) : P.black; c.fill();
  if (!H) { const v = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, R); v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(1, "rgba(255,255,255,0.06)"); c.fillStyle = v; c.fill(); }
  const rnd = rng(7); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = H ? g(120) : grad(); c.fillStyle = H ? g(120) : grad();
  const node = (a, r, filled) => { c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R * (filled ? 0.008 : 0.013), 0, Math.PI * 2); if (filled) c.fill(); else { c.lineWidth = R * 0.005; c.stroke(); } };
  for (const side of [Math.PI, 0]) {
    const radii = [0.78, 0.81, 0.845, 0.875, 0.905, 0.935];
    for (let k = 0; k < radii.length; k++) {
      const r = R * radii[k], span = 0.28 + rnd() * 0.42, off = (rnd() - 0.5) * 0.5, a0 = side - span + off, a1 = side + span * (0.7 + rnd() * 0.5) + off;
      c.lineWidth = R * 0.0055;
      if (rnd() > 0.45) { const am = a0 + (a1 - a0) * (0.35 + rnd() * 0.3), r2 = R * radii[Math.min(radii.length - 1, k + 1)] - R * 0.004; c.beginPath(); c.arc(cx, cy, r, a0, am); c.lineTo(cx + Math.cos(am) * r2, cy + Math.sin(am) * r2); c.arc(cx, cy, r2, am, a1); c.stroke(); node(a0, r, rnd() > 0.5); node(a1, r2, rnd() > 0.5); }
      else { c.beginPath(); c.arc(cx, cy, r, a0, a1); c.stroke(); node(a0, r, rnd() > 0.5); node(a1, r, rnd() > 0.5); }
    }
    for (let k = 0; k < 5; k++) { const a = side + (rnd() - 0.5) * 1.2, r = R * (0.79 + rnd() * 0.14); node(a, r, rnd() > 0.4); }
  }
  c.fillStyle = H ? g(215) : P.white;
  arcText(c, TEXT.top, cx, cy, R * 0.84, -Math.PI / 2, R * 0.102, false, 0.13);
  c.save(); c.font = `700 ${R * 0.03}px Arial`; c.textAlign = "left"; c.translate(cx + R * 0.6, cy - R * 0.6); c.rotate(0.78); c.fillText("TM", 0, 0); c.restore();
  arcText(c, TEXT.bottom, cx, cy, R * 0.84, Math.PI / 2, R * 0.102, true, 0.13);
  c.lineWidth = R * 0.046; c.strokeStyle = H ? g(150) : grad(); c.beginPath(); c.arc(cx, cy, R * 0.725, 0, Math.PI * 2); c.stroke();
  c.lineWidth = R * 0.004; c.strokeStyle = H ? g(200) : "rgba(226,228,238,0.5)"; for (const r of [0.768, 0.7]) { c.beginPath(); c.arc(cx, cy, R * r, 0, Math.PI * 2); c.stroke(); }
  c.beginPath(); c.arc(cx, cy, R * 0.698, 0, Math.PI * 2); c.fillStyle = H ? g(30) : P.navy; c.fill();
  c.save(); c.clip(); c.font = `500 ${R * 0.027}px "Hanken Grotesk", monospace`; c.textAlign = "center"; c.textBaseline = "middle";
  const rb = rng(3); for (let y = -0.69; y < 0.69; y += 0.046) for (let x = -0.69; x < 0.69; x += 0.038) { const bright = rb() > 0.9; c.fillStyle = H ? g(bright ? 52 : 40) : (bright ? "rgba(143,140,250,0.75)" : "rgba(86,90,160,0.38)"); c.fillText(rb() > 0.5 ? "1" : "0", cx + x * R, cy + y * R); }
  c.restore();
  const q = R * 0.385, rad = R * 0.09; c.save();
  rr(c, cx - q, cy - q, q * 2, q * 2, rad); c.fillStyle = H ? g(175) : grad(); c.fill();
  const q2 = q - R * 0.03; rr(c, cx - q2, cy - q2, q2 * 2, q2 * 2, rad - R * 0.028); c.fillStyle = H ? g(185) : P.white; c.fill();
  const m = qrModules(), inner = q2 - R * 0.04, cell = (inner * 2) / m.n; c.fillStyle = H ? g(175) : "#111118";
  for (let r = 0; r < m.n; r++) for (let cc = 0; cc < m.n; cc++) if (m.at(r, cc)) c.fillRect(cx - inner + cc * cell, cy - inner + r * cell, cell + 0.4, cell + 0.4);
  c.restore();
  c.lineWidth = R * 0.034; c.strokeStyle = H ? g(255) : P.silver; c.beginPath(); c.arc(cx, cy, R * 0.983, 0, Math.PI * 2); c.stroke();
}
function heightToNormal(hc, S, strength) {
  const src = hc.getContext("2d").getImageData(0, 0, S, S).data, out = document.createElement("canvas"); out.width = out.height = S;
  const oc = out.getContext("2d"), img = oc.createImageData(S, S), d = img.data, at = (x, y) => src[((Math.min(S - 1, Math.max(0, y)) * S) + Math.min(S - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  oc.putImageData(img, 0, 0); return out;
}
const blur = (cv, px) => { const S = cv.width, t = document.createElement("canvas"); t.width = t.height = S; const c = t.getContext("2d"); c.filter = `blur(${px}px)`; c.drawImage(cv, 0, 0); return t; };
function colorMap(S, P) { const col = document.createElement("canvas"); col.width = col.height = S; drawFace(col.getContext("2d"), S, "c", P); return col; }
function makeCoinTextures(S, P) {
  const col = colorMap(S, P);
  const hgt = document.createElement("canvas"); hgt.width = hgt.height = S; drawFace(hgt.getContext("2d"), S, "h", P);
  const nrm = heightToNormal(blur(hgt, S / 1280), S, 3.2);
  const rg = document.createElement("canvas"); rg.width = rg.height = S; const rc = rg.getContext("2d"), hd = hgt.getContext("2d").getImageData(0, 0, S, S).data, im = rc.createImageData(S, S);
  for (let i = 0; i < hd.length; i += 4) { const h = hd[i], rough = h > 170 ? 0.33 : h > 100 ? 0.42 : h > 35 ? 0.58 : 0.5; im.data[i] = 255; im.data[i + 1] = rough * 255; im.data[i + 2] = 255; im.data[i + 3] = 255; }
  rc.putImageData(im, 0, 0);
  const E = 2048, en = document.createElement("canvas"); en.width = E; en.height = 64; { const o = en.getContext("2d"), oi = o.createImageData(E, 64); for (let x = 0; x < E; x++) { const l = 0.5 + 0.5 * Math.sin(((x - 1) / E) * Math.PI * 2 * 180), r = 0.5 + 0.5 * Math.sin(((x + 1) / E) * Math.PI * 2 * 180); let nx = -(r - l) * 6, nz = 1; const len = Math.hypot(nx, nz); for (let y = 0; y < 64; y++) { const i = (y * E + x) * 4; oi.data[i] = (nx / len * 0.5 + 0.5) * 255; oi.data[i + 1] = 128; oi.data[i + 2] = (nz / len * 0.5 + 0.5) * 255; oi.data[i + 3] = 255; } } o.putImageData(oi, 0, 0); }
  return { color: col, normal: nrm, rough: rg, edgeNormal: en };
}
function makeCoin(T, P, envMap) {
  const tex = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
  const map = tex(T.color, true), normalMap = tex(T.normal), roughMap = tex(T.rough);
  const faceMat = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1, -1), roughnessMap: roughMap, metalnessMap: roughMap, metalness: 1, roughness: 1, envMap, envMapIntensity: 1.1 });
  const edgeN = tex(T.edgeNormal); edgeN.wrapS = THREE.RepeatWrapping;
  const silver = new THREE.MeshStandardMaterial({ color: P.metal, metalness: 1, roughness: 0.3, envMap, envMapIntensity: 1.1 });
  const silverEdge = new THREE.MeshStandardMaterial({ color: P.metal, metalness: 1, roughness: 0.38, normalMap: edgeN, normalScale: new THREE.Vector2(0.9, 0.9), envMap, envMapIntensity: 1.1 });
  const radius = 1, h = 0.0869, g = new THREE.Group();
  const faceGeo = new THREE.CircleGeometry(radius * 0.968, 128);
  const top = new THREE.Mesh(faceGeo, faceMat); top.position.z = h; g.add(top);
  const bottom = new THREE.Mesh(faceGeo, faceMat); bottom.position.z = -h; bottom.rotation.y = Math.PI; g.add(bottom);
  const lip = new THREE.LatheGeometry([[0.962, 0], [0.972, h * 0.1], [0.988, h * 0.14], [0.998, h * 0.08], [1, 0]].map((p) => new THREE.Vector2(p[0] * radius, p[1])), 128);
  const lipTop = new THREE.Mesh(lip, silver); lipTop.rotation.x = Math.PI / 2; lipTop.position.z = h; g.add(lipTop);
  const lipBot = new THREE.Mesh(lip, silver); lipBot.rotation.x = -Math.PI / 2; lipBot.position.z = -h; g.add(lipBot);
  const side = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h * 2, 180, 1, true), silverEdge); side.rotation.x = Math.PI / 2; g.add(side);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, h * 1.96, 64), new THREE.MeshStandardMaterial({ color: "#101014", metalness: 1, roughness: 0.6 })); core.rotation.x = Math.PI / 2; g.add(core);
  g.userData = { faceMat, silver, silverEdge, map };
  return g;
}

