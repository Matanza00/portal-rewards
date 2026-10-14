/* ======================================================================
   3. Sound (optional, synthesised)
   ====================================================================== */
let actx = null;
const tone = (f, t, dur, type = "sine", vol = 0.12, slide) => { if (!state.sound) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + t; o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05); } catch (e) {} };
const sfx = { tick: () => tone(1800, 0, 0.05, "triangle", 0.04), chime: () => { tone(660, 0, 0.5); tone(990, 0.08, 0.6); tone(1320, 0.16, 0.9, "sine", 0.08); }, coin: () => { tone(1200, 0, 0.12, "square", 0.03); tone(1600, 0.06, 0.18, "square", 0.03); }, whoosh: () => tone(220, 0, 0.35, "sawtooth", 0.03), portal: () => { tone(90, 0, 1.3, "sawtooth", 0.05, 900); tone(440, 0.2, 1.0, "sine", 0.05, 1760); }, draw: () => tone(2400, 0, 0.03, "triangle", 0.015), dial: () => { tone(520, 0, 0.07, "square", 0.025); tone(180, 0.02, 0.12, "triangle", 0.04); }, kawoosh: () => { tone(55, 0, 1.1, "sawtooth", 0.06, 420); tone(2200, 0.05, 0.6, "sine", 0.035, 260); }, zap: () => tone(3200, 0, 0.06, "sawtooth", 0.008, 700) };
window.__sfx = sfx;
const soundBtn = $("#sound");
function setSound(on) { state.sound = on; soundBtn.classList.toggle("on", on); soundBtn.setAttribute("aria-pressed", String(on)); soundBtn.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on"); soundBtn.querySelector("span").textContent = on ? "Sound on" : "Sound off"; try { localStorage.setItem("pr-sound", on ? "1" : "0"); } catch (e) {} if (on) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {} sfx.chime(); } }
soundBtn.addEventListener("click", () => setSound(!state.sound));
try { if (localStorage.getItem("pr-sound") === "1") { state.sound = true; soundBtn.classList.add("on"); soundBtn.setAttribute("aria-pressed", "true"); soundBtn.querySelector("span").textContent = "Sound on"; } } catch (e) {}

/* ======================================================================
   4. Router: three pages in one file; picking a side flies through the portal
   ====================================================================== */
const NAV = { home: [["#two-sides", "Two sides"], ["#how-home", "How it works"], ["#story", "Maya's story"]], consumer: [["#how-consumer", "How it works"], ["#wallet", "Your wallet"], ["#suggest", "Suggest a brand"], ["#contact-consumer", "Contact"]], brand: [["#why", "Why a coin"], ["#compare", "Before & after"], ["#calc", "Estimate"], ["#token", "The token"], ["#pricing", "Pricing"], ["#contact-brand", "Contact"]] };
const nav = $("#navlinks"), menu = $("#menu"), burger = $("#burger");
function renderNav() { const items = NAV[state.page].map(([h, t]) => `<a href="${h}" data-anchor="${h.slice(1)}">${t}</a>`).join(""); nav.innerHTML = items; menu.innerHTML = items + `<a href="#consumer" data-route="consumer">Consumer side</a><a href="#brand" data-route="brand">Brand side</a>`; }
// decode effect: text nodes settle from scrambled characters into the real words
const GLYPHS = "01PORTAL#%&✦<>/";
function decode(root) { if (!root) return; const nodes = []; const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3 && c.nodeValue.trim()) nodes.push({ n: c, s: c.nodeValue }); else if (c.nodeType === 1) walk(c); } }; walk(root); const t0 = performance.now(); const step = (now) => { const k = Math.min(1, (now - t0) / 900); for (const { n, s } of nodes) { let out = ""; for (let i = 0; i < s.length; i++) { const ch = s[i]; out += ch === " " || i < k * s.length ? ch : GLYPHS[(i * 7 + Math.floor(now / 40)) % GLYPHS.length]; } n.nodeValue = out; } if (k < 1) requestAnimationFrame(step); else nodes.forEach(({ n, s }) => (n.nodeValue = s)); }; requestAnimationFrame(step); }
function showPage(name, { anchor = null, land = true } = {}) {
  if (!NAV[name]) name = "home";
  $$(".page").forEach((p) => p.classList.toggle("on", p.dataset.page === name)); state.page = name; renderNav();
  $("#sw-c").classList.toggle("on", name === "consumer"); $("#sw-b").classList.toggle("on", name === "brand");
  document.title = name === "home" ? "Portal Rewards" : name === "consumer" ? "Portal Rewards · For consumers" : "Portal Rewards · For brands";
  if (anchor) { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior: "instant", block: "start" }); } else scrollTo({ top: 0, behavior: "instant" });
  watchReveal(); state.introT = land ? 0.35 : 0.6; coinPos.copy(coinTarget); state.flipV = land ? 5 : 0;
  if (land) $$(".page.on [data-decode]").forEach(decode);
  if (land && name === "home") window.__gate?.dial();
}
window.__showPage = (n) => showPage(n);
function navigate(route, anchor, push = true) {
  if (route !== state.page) { if (anchor) showPage(route, { anchor, land: false }); else openPortal(route); }
  else if (anchor) { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } else scrollTo({ top: 0, behavior: "smooth" });
  if (push) history.replaceState(null, "", "#" + (anchor && route !== "home" && !/^contact-/.test(anchor) ? anchor : route)); menu.hidden = true; burger.setAttribute("aria-expanded", "false");
}
document.addEventListener("click", (e) => { const a = e.target.closest("a[data-route], a[data-anchor]"); if (!a) return; e.preventDefault(); sfx.tick(); navigate(a.dataset.route || state.page, a.dataset.anchor || null); });
const ANCHOR_PAGE = { "two-sides": "home", "how-home": "home", story: "home", "how-consumer": "consumer", wallet: "consumer", suggest: "consumer", "contact-consumer": "consumer", why: "brand", compare: "brand", calc: "brand", token: "brand", pricing: "brand", "contact-brand": "brand" };
function fromHash() { const h = (location.hash || "#home").slice(1).replace(/[^a-z0-9-]/gi, ""); if (NAV[h]) showPage(h, { land: false }); else if (ANCHOR_PAGE[h]) showPage(ANCHOR_PAGE[h], { anchor: h, land: false }); else showPage("home", { land: false }); }
addEventListener("hashchange", fromHash);
burger.addEventListener("click", () => { const open = menu.hidden; menu.hidden = !open; burger.setAttribute("aria-expanded", String(open)); });
$("#again").addEventListener("click", () => { if (state.page === "home") { scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => { state.introT = 0; state.flipV = 6; window.__gate?.dial(); }, 600); } else openPortal("home"); });
// hovering a side previews its colour in the gate
[["#hero .btn.c, .side.c", "#3ad0ff"], ["#hero .btn.b, .side.b", "#ff4fd8"]].forEach(([sel, col]) => $$(sel).forEach((el) => { el.addEventListener("pointerenter", () => window.__gate?.tint(col)); el.addEventListener("pointerleave", () => window.__gate?.tint(null)); el.addEventListener("focus", () => window.__gate?.tint(col)); el.addEventListener("blur", () => window.__gate?.tint(null)); }));

/* ======================================================================
   5. Page furniture: demos, storyboard, forms, reveal, cursor, discoveries
   ====================================================================== */
$$("[data-demos]").forEach((host) => host.append($("#demo-tpl").content.cloneNode(true)));
$$("[data-contact]").forEach((host) => host.append($("#contact-tpl").content.cloneNode(true)));
// the pouch illustration (SVG) used by the demo and the brand argument
const POUCH = `<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#231e38"/><stop offset="1" stop-color="#0d0b14"/></linearGradient><radialGradient id="pglow" cx=".8" cy=".9" r=".6"><stop offset="0" stop-color="#ffb070" stop-opacity=".5"/><stop offset=".5" stop-color="#9a6bff" stop-opacity=".25"/><stop offset="1" stop-color="#9a6bff" stop-opacity="0"/></radialGradient></defs>
<path d="M14 40 Q10 24 24 20 L96 20 Q110 24 106 40 L110 150 Q110 166 94 166 L26 166 Q10 166 10 150 Z" fill="url(#pg)" stroke="rgba(255,255,255,.14)"/>
<ellipse cx="86" cy="140" rx="36" ry="30" fill="url(#pglow)"/>
<g class="flap"><path d="M20 22 Q60 12 100 22 L96 34 Q60 26 24 34 Z" fill="#2a2544" stroke="rgba(255,255,255,.18)"/><path class="zip" d="M24 29 L96 29" stroke="#cfc8e6" stroke-width="2" stroke-dasharray="4 3"/></g>
<g class="beans" fill="#5a3b2a" stroke="#8a5a3e"><ellipse cx="34" cy="112" rx="7" ry="4.5" transform="rotate(-25 34 112)"/><ellipse cx="50" cy="128" rx="7" ry="4.5" transform="rotate(20 50 128)"/><ellipse cx="30" cy="142" rx="7" ry="4.5" transform="rotate(-10 30 142)"/></g>
<text x="60" y="152" text-anchor="middle" font-family="DM Mono, monospace" font-size="7" letter-spacing="2" fill="#8f89a6">NORTHPINE</text>`;
$$("svg[data-pouch]").forEach((s) => (s.innerHTML = POUCH));

let revealObs;
function watchReveal() { revealObs?.disconnect(); revealObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }); $$(".page.on .rv").forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add("in"); else revealObs.observe(el); }); }
function paintFaces() { if (!faceURL) return; $$("img.coin-face").forEach((img) => { if (!img.src) img.src = faceURL; }); }

// discoveries: a light scavenger hunt across the interactions
const FOUND = new Set(), DISC_N = 9, discEl = $("#disc"), discN = $("#discn");
function discover(key) { if (FOUND.has(key)) return; FOUND.add(key); discN.textContent = FOUND.size; discEl.classList.remove("bump"); void discEl.offsetWidth; discEl.classList.add("bump"); if (FOUND.size >= DISC_N) { discEl.classList.add("full"); discEl.querySelector("span:last-child").textContent = "/ 9 · portal charged"; state.flipV = 8; sfx.chime(); } else sfx.tick(); }
window.__discover = discover;
discEl.addEventListener("click", () => { discEl.querySelector("span:last-child").textContent = FOUND.size >= DISC_N ? "/ 9 · portal charged" : "/ 9 · flip, drag, open, scan, redeem, recolour, slide, fix, warp"; setTimeout(() => { if (FOUND.size < DISC_N) discEl.querySelector("span:last-child").textContent = "/ 9 found"; }, 4000); });

// demos: open the pouch (hover opens, tap pins), scan with progress, redeem with flying coins
function setPouch(d, open, pin) { d.classList.toggle("open", open); if (pin !== undefined) d.dataset.pin = pin ? "1" : ""; d.querySelector(".state").textContent = open ? "Open · there it is" : "Closed · tap to open"; if (open) { discover("open"); sfx.coin(); for (let i = 0; i < 6; i++) { const s = document.createElement("i"); s.className = "spark"; s.style.left = "50%"; s.style.top = "40%"; d.appendChild(s); s.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${(Math.random() - .5) * 160}px, ${-40 - Math.random() * 120}px)`, opacity: 0 }], { duration: 800 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.2,1)" }).onfinish = () => s.remove(); } } }
$$(".demo.find").forEach((d) => { d.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !d.dataset.pin) setPouch(d, true); }); d.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !d.dataset.pin) setPouch(d, false); }); d.addEventListener("click", () => { const open = !d.classList.contains("open") || !d.dataset.pin; setPouch(d, open, open); }); d.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); d.click(); } }); });
function runScan(scan) { if (scan.classList.contains("go")) return; scan.classList.add("go"); scan.querySelector(".state").textContent = "Scanning…"; sfx.tick(); setTimeout(() => { scan.querySelector(".toast").classList.add("show"); scan.querySelector(".state").textContent = "Verified · +50 coins"; sfx.chime(); bumpWallet(50); discover("scan"); }, 2200); setTimeout(() => { scan.classList.remove("go"); scan.querySelector(".toast").classList.remove("show"); scan.querySelector(".state").textContent = "Ready · tap to scan"; }, 4400); }
$$(".demo.scan").forEach((s) => { s.addEventListener("click", () => runScan(s)); s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); runScan(s); } }); });
document.addEventListener("click", (e) => { const redeem = e.target.closest(".demo.earn .redeem"); if (!redeem) return; const w = redeem.closest(".wallet"), big = w.querySelector(".big"), cur = +big.dataset.count; if (cur < 500) { w.querySelector(".left").textContent = "not enough yet"; return; } setCount(big, cur - 500); w.querySelector(".bar i").style.width = ((cur - 500) % 1500 / 1500 * 100) + "%"; w.querySelector(".left").textContent = (1500 - (cur - 500) % 1500) + " to go"; flyCoins(redeem); sfx.coin(); discover("redeem"); });
function setCount(el, v) { const from = +el.dataset.count, t0 = performance.now(); el.dataset.count = v; const step = (now) => { const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (v - from) * e).toLocaleString("en-US"); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function bumpWallet(n) { $$(".page.on .demo.earn .big").forEach((b) => { const v = +b.dataset.count + n; setCount(b, v); const w = b.closest(".wallet"); w.querySelector(".bar i").style.width = (v % 1500 / 1500 * 100) + "%"; w.querySelector(".left").textContent = (1500 - v % 1500) + " to go"; }); const bal = $("#bal"); if (bal) setCount(bal, +bal.dataset.count + n); }
function flyCoins(btn) { const host = btn.closest(".demo, .app"), r = btn.getBoundingClientRect(), hr = host.getBoundingClientRect(); for (let i = 0; i < 7; i++) { const f = document.createElement("img"); f.className = "fly"; f.src = faceURL || ""; f.style.left = (r.left - hr.left + r.width / 2 - 13) + "px"; f.style.top = (r.top - hr.top) + "px"; host.appendChild(f); const dx = (Math.random() - 0.5) * 240, dy = -120 - Math.random() * 160; f.animate([{ transform: "translate(0,0) scale(.6)", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(1.1) rotate(${(Math.random() - .5) * 400}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.2,.7,.2,1)" }).onfinish = () => f.remove(); } }
// wallet mockup
const BAL = { brand: ["Brand Coins · never expire", 1240], portal: ["Portal Coins · every brand", 3860] }; $("#bal").dataset.count = 1240;
$$("#app .tabs button").forEach((b) => b.addEventListener("click", () => { $$("#app .tabs button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); }); const [lab, v] = BAL[b.dataset.tab]; $("#bal-lab").textContent = lab; setCount($("#bal"), v); sfx.tick(); }));
$("#app .cta").addEventListener("click", (e) => { flyCoins(e.currentTarget); sfx.coin(); discover("redeem"); });
const bigObs = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; $$("#biglist span").forEach((s, i) => setTimeout(() => s.classList.add("lit"), 200 + i * 260)); bigObs.disconnect(); }), { threshold: 0.4 }); bigObs.observe($("#biglist"));

/* ---------- Maya's story: a hand-drawn storyboard, one panel per step ---------- */
let skS = 5; const skR = () => { skS = (skS * 16807) % 2147483647; return skS / 2147483647 - 0.5; }, f1 = (v) => v.toFixed(1);
const skL = (x1, y1, x2, y2, j = 1.2) => { const dx = x2 - x1, dy = y2 - y1; return `M${f1(x1 - dx * .02 + skR() * j)},${f1(y1 - dy * .02 + skR() * j)} Q${f1((x1 + x2) / 2 + skR() * j * 2.4)},${f1((y1 + y2) / 2 + skR() * j * 2.4)} ${f1(x2 + dx * .02 + skR() * j)},${f1(y2 + dy * .02 + skR() * j)}`; };
const skBox = (x, y, w, h, j) => [skL(x, y, x + w, y, j), skL(x + w, y, x + w, y + h, j), skL(x + w, y + h, x, y + h, j), skL(x, y + h, x, y - 1, j)].join(" ");
const skCirc = (cx, cy, r) => { let d = ""; for (let k = 0; k <= 14; k++) { const a = (k / 13) * Math.PI * 2 + .3, rr2 = r * (1 + skR() * .12); d += `${k ? " L" : "M"}${f1(cx + Math.cos(a) * rr2)},${f1(cy + Math.sin(a) * rr2)}`; } return d; };
const S_ = (d, a, b, cls = "") => ({ t: "p", d, a, b, cls }), W_ = (x, y, txt, a, b, size = 20, cls = "") => ({ t: "w", x, y, txt, a, b, size, cls });
function storyPanels() {
  skS = 5; const P = [[0, 0], [400, 0], [0, 280], [400, 280]];   // four panels on an 800×560 board
  const pouch = (x, y) => [S_(`${skL(x + 8, y + 24, x + 92, y + 24)} ${skL(x + 92, y + 24, x + 98, y + 120)} ${skL(x + 98, y + 120, x + 2, y + 120)} ${skL(x + 2, y + 120, x + 8, y + 24)}`, 0, .22), S_(skL(x + 14, y + 34, x + 86, y + 34), .22, .28, "dim"), W_(x + 20, y + 110, "beans", .3, .36, 16)];
  return [
    [...pouch(60, 70), ...[0, 1, 2, 3].map((i) => S_(skCirc(80 + (i % 2) * 26 + skR() * 6, 150 + Math.floor(i / 2) * 18 + skR() * 4, 6), .36 + i * .03, .4 + i * .03)),
      S_(skCirc(190, 110, 34), .48, .6, "am"), S_(skBox(176, 96, 28, 28, 1), .6, .68, "am"), S_(`${skL(182, 103, 190, 103)} ${skL(182, 112, 196, 112)} ${skL(190, 103, 190, 118)}`, .68, .74, "am"),
      S_(`${skL(240, 120, 286, 100)} M278,98 L288,99 M283,106 L288,99`, .76, .84, "dim"), W_(292, 96, "the coin!", .84, .96, 24, "am")],
    [S_(skBox(470, 50, 100, 180, 1.4), 0, .2), S_(skL(500, 62, 540, 62), .2, .24, "dim"), S_(`${skL(486, 92, 486, 78)} ${skL(486, 78, 500, 78)} M540,78 L554,78 M554,78 L554,92 M486,186 L486,200 M486,200 L500,200 M554,186 L554,200 M554,200 L540,200`, .24, .36, "cy"),
      S_(skCirc(520, 140, 30), .36, .48, "am"), S_(skBox(508, 128, 24, 24, 1), .48, .54, "am"), S_(skL(490, 118, 550, 118), .56, .62, "cy"), S_(skL(490, 164, 550, 164), .62, .68, "cy"),
      S_(`${skL(600, 110, 640, 110)} ${skL(600, 125, 650, 125)} ${skL(600, 140, 630, 140)}`, .7, .8, "dim"), S_(`${skL(585, 150, 600, 166)} ${skL(600, 166, 626, 134)}`, .8, .88, "cy"), W_(600, 198, "scan · 2 seconds", .88, 1, 20, "cy")],
    [S_(`${skL(70, 420, 70, 500)} ${skL(70, 500, 210, 500)} ${skL(210, 500, 210, 420)} ${skL(210, 420, 70, 420)}`, 0, .2), S_(`${skL(70, 420, 90, 395)} ${skL(90, 395, 230, 395)} ${skL(230, 395, 210, 420)}`, .2, .32), S_(skBox(170, 448, 34, 24, 1), .32, .4, "dim"), S_(skCirc(187, 460, 5), .4, .44),
      ...[0, 1, 2].map((i) => S_(skCirc(120 + i * 34, 330 + (i % 2) * 18, 13), .46 + i * .08, .54 + i * .08, "am")), ...[0, 1, 2].map((i) => S_(`${skL(126 + i * 34, 350 + (i % 2) * 18, 140 + i * 24, 392)}`, .52 + i * .08, .58 + i * .08, "dim")),
      W_(240, 365, "+50", .78, .88, 42, "am"), W_(238, 395, "never expire", .88, 1, 20)],
    [S_(skCirc(480, 350, 24), 0, .12), S_(`${skL(440, 420, 452, 388)} ${skL(452, 388, 508, 388)} ${skL(508, 388, 520, 420)}`, .12, .26), S_(skBox(560, 330, 150, 60, 1.2), .3, .44, "cy"), S_(`${skL(560, 390, 552, 404)} ${skL(552, 404, 580, 390)}`, .44, .5, "cy"),
      W_(574, 356, "Maya just scanned", .5, .66, 19, "cy"), W_(574, 378, "bag #0412  ✓", .66, .74, 19, "cy"),
      ...pouch(440, 430), W_(560, 480, "a real person,", .78, .9, 22, "am"), W_(560, 506, "not an invoice", .9, 1, 22, "am")],
  ].map((items, i) => ({ items, panel: P[i] }));
}
const PENCIL = `<g id="pen"><path d="M0,0 L-5,-14 L5,-14 Z" fill="#e9c896"/><rect x="-5" y="-110" width="10" height="96" fill="#f6c343"/><rect x="-5" y="-110" width="3.5" height="96" fill="#ffd96b"/><rect x="-5.5" y="-122" width="11" height="12" fill="#b8bcc6"/><rect x="-5.5" y="-135" width="11" height="13" rx="3" fill="#f08a8a"/></g>`;
const board = $("#board"), PANELS = storyPanels(); let boardItems = [], boardT = PANELS.map(() => 0), boardStep = 0, boardPlaying = -1, boardAuto = null;
function buildBoard() {
  const svg = `<svg viewBox="0 0 800 560" aria-label="Hand-drawn storyboard of Maya finding, scanning and earning with a coin">${PANELS.map(({ panel: [x, y] }, i) => `<rect class="pane" x="${x + 10}" y="${y + 10}" width="380" height="260" rx="10"/><text class="hw" x="${x + 24}" y="${y + 36}" font-size="18" fill="#5a5570">${i + 1}</text>`).join("")}${PANELS.map(({ items }, pi) => items.map((it, k) => it.t === "p" ? `<path class="sk ${it.cls}" data-p="${pi}" data-k="${k}" d="${it.d}"/>` : `<text class="hw ${it.cls}" data-p="${pi}" data-k="${k}" x="${it.x}" y="${it.y}" font-size="${it.size}">${it.txt}</text>`).join("")).join("")}${PENCIL}</svg>`;
  board.insertAdjacentHTML("afterbegin", svg);
  boardItems = PANELS.map(({ items }, pi) => items.map((it, k) => { const el = board.querySelector(`[data-p="${pi}"][data-k="${k}"]`); const o = { ...it, el }; if (it.t === "p") { o.len = el.getTotalLength(); el.style.strokeDasharray = `${o.len} ${o.len}`; } return o; }));
  renderBoard();
}
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
function renderBoard() {
  let tip = null;
  boardItems.forEach((items, pi) => { const T = boardT[pi]; items.forEach((it) => { const p = seg(T, it.a, it.b); if (it.t === "p") { it.el.style.strokeDashoffset = (it.len * (1 - p)).toFixed(1); it.el.style.visibility = p > 0 ? "visible" : "hidden"; it.el.style.strokeLinecap = p < 1 ? "butt" : ""; if (p > 0 && p < 1) { const pt = it.el.getPointAtLength(it.len * p); tip = [pt.x, pt.y]; } } else { it.el.style.visibility = p > 0 ? "visible" : "hidden"; it.el.style.clipPath = p >= 1 || p <= 0 ? "none" : `inset(-40% ${(100 - p * 100).toFixed(1)}% -40% -6%)`; if (p > 0 && p < 1) { const b = it.el.getBBox(); tip = [b.x + b.width * p, b.y + b.height * 0.8]; } } }); });
  const pen = board.querySelector("#pen"); if (pen) { pen.style.opacity = tip ? 1 : 0; if (tip) pen.setAttribute("transform", `translate(${tip[0].toFixed(1)} ${tip[1].toFixed(1)}) rotate(26)`); }
}
function drawPanel(i) {
  boardStep = i; $$("#timeline li").forEach((li, j) => li.classList.toggle("on", j === i));
  for (let j = 0; j < PANELS.length; j++) if (j < i && boardT[j] < 1) boardT[j] = 1; else if (j > i) boardT[j] = 0;
  if (boardT[i] >= 1) boardT[i] = 0; boardPlaying = i; const t0 = performance.now(); sfx.draw();
  const step = (now) => { if (boardPlaying !== i) return; boardT[i] = Math.min(1, (now - t0) / 1700); renderBoard(); if (boardT[i] < 1) requestAnimationFrame(step); else boardPlaying = -1; }; requestAnimationFrame(step);
}
function playStory() { clearTimeout(boardAuto); boardT = PANELS.map(() => 0); let i = 0; const next = () => { drawPanel(i); i++; if (i < PANELS.length) boardAuto = setTimeout(next, 2100); }; next(); discover("story"); }
$$("#timeline li").forEach((li) => li.addEventListener("click", () => { clearTimeout(boardAuto); drawPanel(+li.dataset.step); }));
$("#replay").addEventListener("click", playStory);
const storyObs = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; playStory(); storyObs.disconnect(); }), { threshold: 0.35 }); storyObs.observe(board);

// suggest a brand
$("#suggest-form").addEventListener("submit", (e) => { e.preventDefault(); const inp = $("#brand-name"), v = inp.value.trim(), f = inp.closest(".field"), msg = $("#brand-msg"); if (v.length < 2) { f.classList.add("err"); msg.textContent = "Type a brand name first."; return; } f.classList.remove("err"); msg.textContent = ""; const chip = document.createElement("span"); chip.innerHTML = `${v.replace(/[<>&]/g, "")} <b style="color:var(--green)">✓ noted</b>`; $("#chips").prepend(chip); inp.value = ""; sfx.chime(); });
// contact forms: validate in the page, and be honest that this prototype doesn't send
$$("form.form").forEach((form) => form.addEventListener("submit", (e) => { e.preventDefault(); let ok = true; $$(".field", form).forEach((f) => { const inp = f.querySelector("input, textarea"), msg = f.querySelector(".msg"); let err = ""; if (inp.required && !inp.value.trim()) err = "This one's needed."; else if (inp.type === "email" && inp.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.value)) err = "That email doesn't look right."; f.classList.toggle("err", !!err); msg.textContent = err; if (err) ok = false; }); if (!ok) { sfx.tick(); return; } const okb = form.querySelector(".ok"); okb.hidden = false; okb.textContent = `Thanks, ${form.name.value.trim().split(" ")[0]}. In the live site this goes to the Portal team; this prototype keeps it on your screen.`; sfx.chime(); }));
document.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (!b) return; navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1600); }).catch(() => { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); getSelection().removeAllRanges(); getSelection().addRange(r); }); });
// brand: arguments progress, comparison (hover pairs, click fixes), calculator, colorways
const args = $$("#args .arg"); const argObs = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; const i = args.indexOf(e.target); args.forEach((a, j) => a.classList.toggle("on", j === i)); $("#argbar").style.width = ((i + 1) / args.length * 100) + "%"; }), { rootMargin: "-40% 0px -45% 0px" }); args.forEach((a) => argObs.observe(a));
$$("#cmp .li").forEach((li) => { const pair = () => $$(`#cmp .li[data-i="${li.dataset.i}"]`); li.tabIndex = 0; li.addEventListener("mouseenter", () => pair().forEach((x) => x.classList.add("hl"))); li.addEventListener("mouseleave", () => $$("#cmp .li").forEach((x) => x.classList.remove("hl"))); li.addEventListener("click", () => { if (!li.closest(".no")) return; li.classList.add("fixed"); const yes = pair().find((x) => x.closest(".yes")); yes.classList.remove("pulse"); void yes.offsetWidth; yes.classList.add("pulse"); sfx.coin(); discover("fix"); }); li.addEventListener("keydown", (e) => { if (e.key === "Enter") li.click(); }); });
const R = { units: $("#r-units"), scan: $("#r-scan"), repeat: $("#r-repeat"), aov: $("#r-aov") }, money = (v) => "$" + Math.round(v).toLocaleString("en-US");
function calc() { const u = +R.units.value, s = +R.scan.value / 100, rp = +R.repeat.value / 100, a = +R.aov.value; const named = u * s, orders = named * rp, rev = orders * a; $("#o-units").textContent = u.toLocaleString("en-US"); $("#o-scan").textContent = Math.round(s * 100) + "%"; $("#o-repeat").textContent = Math.round(rp * 100) + "%"; $("#o-aov").textContent = money(a); $("#c-named").textContent = Math.round(named).toLocaleString("en-US"); $("#c-orders").textContent = Math.round(orders).toLocaleString("en-US"); $("#c-rev").textContent = money(rev); $("#c-year").textContent = money(rev * 12); Object.values(R).forEach((r) => r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%")); }
Object.values(R).forEach((r) => r.addEventListener("input", () => { calc(); discover("slide"); })); calc();
$$(".sw button").forEach((b) => b.addEventListener("click", () => { $$(".sw button").forEach((x) => x.classList.toggle("on", x === b)); const key = b.dataset.color; state.colorway = key; sfx.coin(); discover("recolour"); if (!coin) return; const P = PALETTES[key]; const t = new THREE.CanvasTexture(colorMap(mobile ? 1024 : 1536, P)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; coin.userData.faceMat.map.dispose(); coin.userData.faceMat.map = t; coin.userData.faceMat.needsUpdate = true; coin.userData.silver.color.set(P.metal); coin.userData.silverEdge.color.set(P.metal); state.flipV = 4; }));

/* ---------- pointer: cursor, tilt cards, magnetic buttons, coin drag/flip, keyboard ---------- */
const fine = matchMedia("(pointer: fine)").matches; if (fine) document.body.classList.add("fine");
const cur = $("#cur"), curlab = $("#curlab"); let cx = innerWidth / 2, cy = innerHeight / 2, rx = cx, ry = cy; cur.style.opacity = "0";
const inSlot = (e) => { const slot = activeSlot(); if (!slot) return null; const r = slot.r, dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); return Math.hypot(dx, dy) < r.width / 2 ? slot : null; };
addEventListener("pointermove", (e) => {
  cx = e.clientX; cy = e.clientY; cur.style.opacity = ""; state.pointer.tx = (e.clientX / innerWidth - 0.5) * 2; state.pointer.ty = (e.clientY / innerHeight - 0.5) * -2;
  if (state.drag) { const dx = e.clientX - state.drag.x; state.drag.x = e.clientX; state.drag.moved += Math.abs(dx); state.spin += dx * 0.012; state.spinV = dx * 0.6; return; }
  const hot = e.target.closest("[data-cursor], a, button, input, textarea, .demo, .timeline li, .cmp .li"); const slot = !hot && inSlot(e);
  cur.classList.toggle("hot", !!hot || !!slot); curlab.textContent = slot ? "Drag · flip" : (hot?.closest?.("[data-cursor]")?.dataset.cursor || (hot ? "Open" : ""));
}, { passive: true });
addEventListener("pointerleave", () => { state.pointer.tx = 0; state.pointer.ty = 0; });
(function curLoop() { rx = lerp(rx, cx, 0.22); ry = lerp(ry, cy, 0.22); cur.style.transform = `translate(${rx}px, ${ry}px)`; requestAnimationFrame(curLoop); })();
document.addEventListener("pointerdown", (e) => { const b = e.target.closest(".btn"); if (b) { b.classList.add("press"); setTimeout(() => b.classList.remove("press"), 160); } if (e.target.closest("a, button, input, textarea, .demo, .app, .board")) return; const slot = inSlot(e); if (slot) { state.drag = { x: e.clientX, moved: 0 }; } });
addEventListener("pointerup", () => { if (!state.drag) return; const d = state.drag; state.drag = null; if (d.moved < 6) flipCoin(); else discover("drag"); });
function flipCoin() { state.flipV = 9; sfx.coin(); discover("flip"); if (state.page === "home") window.__gate?.ripple(); const toss = $("#toss"); if (toss && state.page === "home") { toss.textContent = Math.random() > 0.5 ? "HEADS · +10" : "TAILS · +10"; toss.classList.remove("show"); void toss.offsetWidth; toss.classList.add("show"); } }
$$(".coin-anchor").forEach((s) => s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCoin(); } if (e.key === "ArrowLeft") { state.spinV = -8; discover("drag"); } if (e.key === "ArrowRight") { state.spinV = 8; discover("drag"); } }));
if (fine) { $$(".btn").forEach((b) => { b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px, ${(e.clientY - r.top - r.height / 2) * 0.2}px)`; }); b.addEventListener("pointerleave", () => (b.style.transform = "")); });
  $$(".tilt").forEach((c) => { c.addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); c.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 6 + "deg"); c.style.setProperty("--rx", ((e.clientY - r.top) / r.height - 0.5) * -6 + "deg"); }); c.addEventListener("pointerleave", () => { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); }); }); }
document.addEventListener("mouseenter", (e) => { if (e.target instanceof Element && e.target.matches?.("a, button")) sfx.tick(); }, true);
let lastY = scrollY; addEventListener("scroll", () => { state.scrollV = scrollY - lastY; lastY = scrollY; const h = document.documentElement.scrollHeight - innerHeight; $("#prog").style.setProperty("--p", h > 0 ? clamp(scrollY / h, 0, 1) : 0); }, { passive: true });

/* ======================================================================
   6. Boot
   ====================================================================== */
async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('600 40px "Hanken Grotesk"'), document.fonts.load('600 20px "Caveat"')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) {}
  try { buildScene(); } catch (e) { console.warn("WebGL unavailable", e); canvas.classList.add("off"); }
  const faceCanvas = textures ? textures.color : colorMap(1024, PALETTES.onyx); const small = document.createElement("canvas"); small.width = small.height = 512; small.getContext("2d").drawImage(faceCanvas, 0, 0, 512, 512); faceURL = small.toDataURL("image/png"); paintFaces();
  if (!state.webgl) { $$(".coin-anchor").forEach((s) => { const img = document.createElement("img"); img.src = faceURL; img.alt = "The Portal Rewards coin"; img.className = "coin2d"; s.appendChild(img); }); }
  buildBoard(); fromHash(); renderNav(); watchReveal();
  if (state.webgl) { resize(); requestAnimationFrame(frame); }
}
addEventListener("resize", () => { resize(); watchReveal(); });
boot();
</script>
