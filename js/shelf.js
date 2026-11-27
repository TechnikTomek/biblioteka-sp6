// ==========================================================
// Interaktywna półka: kliknij grzbiet – książka wysuwa się,
// przelatuje i kładzie się na stole, a obok pojawia się opis.
// ==========================================================
import { BOOKS, CATEGORIES } from "./books.js";
import { cover, coverColor, availTag } from "./ui.js";
import { esc, initials } from "./app.js";

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const hashN = (s, mod) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % mod; };
const shortTitle = (t) => t.split(/[,.]/)[0];
// Jedna lista funkcji we wszystkich klatkach = płynna interpolacja 3D
const T = (ty, rx, rz, s) => `perspective(900px) translateY(${ty}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s})`;
const LAND_RX = 50, LAND_RZ = -7;

export function initShelf(stage, { featuredId } = {}) {
  const shelf = stage.querySelector(".shelf-row");
  const slot = stage.querySelector(".desk-slot");
  const surface = stage.querySelector(".desk-surface");
  const info = stage.querySelector(".desk-info");
  const emptyInfo = info.innerHTML;

  shelf.innerHTML = BOOKS.map((b) => {
    const w = 34 + hashN(b.id, 14), h = 172 + hashN(b.id + "h", 48);
    return `<button class="spine" type="button" data-id="${b.id}" style="--c:${coverColor(b.id)};width:${w}px;height:${h}px"
      aria-label="${esc(b.title)} – ${esc(b.author)}. Połóż na stole">
      <span class="spine-t">${esc(shortTitle(b.title))}</span><span class="spine-a">${esc(initials(b.author))}</span></button>`;
  }).join("");

  let current = null;   // { b, fly, spine }
  let busy = false;

  const rel = (el) => {
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  };
  const box = (p) => ({ left: p.x + "px", top: p.y + "px", width: p.w + "px", height: p.h + "px" });

  function makeFly(b) {
    const f = document.createElement("div");
    f.className = "fly";
    f.dataset.open = b.id;
    f.setAttribute("role", "button");
    f.setAttribute("aria-label", `Szczegóły: ${b.title}`);
    f.innerHTML = `<div class="face face-cover">${cover(b)}</div>
      <div class="face face-spine" style="--c:${coverColor(b.id)}"><span class="spine-t">${esc(shortTitle(b.title))}</span></div>`;
    stage.append(f);
    return f;
  }

  function frames(s, t) {
    const midX = (s.x + t.x) / 2 + (t.x > s.x ? -30 : 30);
    const midY = Math.min(s.y, t.y) - 50;
    const mw = (s.w + t.w) / 2 + 20, mh = (s.h + t.h) / 2;
    return [
      { ...box(s), transform: T(0, 0, 0, 1), offset: 0 },
      { ...box(s), transform: T(-30, -8, 0, 1.1), offset: 0.18 },                       // wysuwa się z półki
      { ...box({ x: midX, y: midY, w: mw, h: mh }), transform: T(-20, 10, -16, 1.12), offset: 0.55 }, // leci i obraca się
      { ...box(t), transform: T(0, LAND_RX + 6, LAND_RZ, 1.03), offset: 0.86 },          // opada na stół
      { ...box(t), transform: T(0, LAND_RX, LAND_RZ, 1), offset: 1 },                    // lekko się „odbija”
    ];
  }

  function crossfade(f, dur, toCover) {
    const show = [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.55 }, { opacity: 1 }];
    const hide = [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }];
    const o = { duration: dur, fill: "forwards", direction: toCover ? "normal" : "reverse" };
    f.querySelector(".face-cover").animate(show, o);
    f.querySelector(".face-spine").animate(hide, o);
  }

  function dust() {
    if (reduce()) return;
    const t = rel(slot);
    for (let i = 0; i < 10; i++) {
      const d = document.createElement("span");
      d.className = "dust";
      const ang = (i / 10) * Math.PI * 2, r = 70 + Math.random() * 40;
      d.style.left = t.x + t.w / 2 + "px"; d.style.top = t.y + t.h * 0.62 + "px";
      stage.append(d);
      d.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 0.7 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * r}px), calc(-50% + ${Math.sin(ang) * r * 0.45}px)) scale(1.6)`, opacity: 0 }],
        { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.2,1)" }).finished.then(() => d.remove());
    }
    surface.animate([{ transform: "translateY(0)" }, { transform: "translateY(2px)" }, { transform: "translateY(0)" }], { duration: 220 });
  }

  function renderInfo(b) {
    info.innerHTML = `<p class="eyebrow">${esc(CATEGORIES[b.category])}${b.isNew ? " · nowość" : ""}</p>
      <h3>${esc(b.title)}</h3>
      <p class="muted">${esc(b.author)} · ${b.year}</p>
      <p>${esc(b.desc || "")}</p>
      <div class="tags" style="margin-bottom:16px">${availTag(b)}</div>
      <div class="desk-actions">
        <button class="btn btn-small" type="button" data-open="${b.id}">Więcej i rezerwacja</button>
        <button class="btn btn-small btn-ghost" type="button" data-putback>Odłóż na półkę</button>
      </div>`;
    if (!reduce()) info.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" });
  }

  async function takeOut(spine) {
    const b = BOOKS.find((x) => x.id === spine.dataset.id);
    const s = rel(spine), t = rel(slot);
    const f = makeFly(b);
    spine.classList.add("out");
    spine.setAttribute("aria-pressed", "true");
    const dur = reduce() ? 1 : 1350;
    const a = f.animate(frames(s, t), { duration: dur, easing: "cubic-bezier(.45,.05,.3,1)", fill: "forwards" });
    crossfade(f, dur, true);
    const cur = { b, fly: f, spine };
    current = cur;
    stage.classList.add("has-book");
    setTimeout(() => { if (current === cur) { dust(); renderInfo(b); } }, dur * 0.86);
    await a.finished;
    Object.assign(f.style, box(t), { transform: T(0, LAND_RX, LAND_RZ, 1) });
    f.getAnimations().forEach((x) => x.cancel());
    f.querySelector(".face-spine").style.opacity = 0;
    f.classList.add("landed");
  }

  // Jeśli półka jest przewinięta (telefon), najpierw pokaż miejsce, do którego wraca książka.
  function ensureVisible(spine) {
    const r = spine.getBoundingClientRect(), v = shelf.getBoundingClientRect();
    if (r.left < v.left || r.right > v.right) shelf.scrollLeft += r.left - v.left - (v.width - r.width) / 2;
  }

  async function putBack(cur) {
    const { fly: f, spine } = cur;
    f.classList.remove("landed");
    ensureVisible(spine);
    const s = rel(spine), t = rel(slot);
    const dur = reduce() ? 1 : 1000;
    const a = f.animate(frames(s, t).reverse().map((k) => ({ ...k, offset: 1 - k.offset })), { duration: dur, easing: "cubic-bezier(.45,.05,.3,1)", fill: "forwards" });
    crossfade(f, dur, false);
    await a.finished;
    f.remove();
    spine.classList.remove("out");
    spine.setAttribute("aria-pressed", "false");
    if (!reduce()) spine.animate([{ transform: "translateY(-10px)" }, { transform: "translateY(2px)" }, { transform: "none" }], { duration: 300 });
  }

  async function choose(spine) {
    if (busy) return;
    busy = true;
    try {
      const prev = current;
      current = null;
      const back = prev ? putBack(prev) : Promise.resolve();
      if (prev && prev.spine === spine) {
        await back;
        stage.classList.remove("has-book");
        info.innerHTML = emptyInfo;
        return;
      }
      await Promise.all([back, takeOut(spine)]);
    } finally { busy = false; }
  }

  shelf.addEventListener("click", (e) => { const sp = e.target.closest(".spine"); if (sp) choose(sp); });
  info.addEventListener("click", (e) => { if (e.target.closest("[data-putback]") && current) choose(current.spine); });
  addEventListener("resize", () => {
    if (current && current.fly.classList.contains("landed")) Object.assign(current.fly.style, box(rel(slot)));
  });

  // Gdy półka pierwszy raz pojawi się na ekranie – sama podaje „książkę tygodnia”.
  if (featuredId && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setTimeout(() => {
        const sp = shelf.querySelector(`[data-id="${featuredId}"]`);
        if (!current && sp) { sp.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); setTimeout(() => !current && choose(sp), 400); }
      }, 700);
    }, { threshold: 0.55 });
    io.observe(stage);
  }
}
