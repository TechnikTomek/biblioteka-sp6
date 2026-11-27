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
const T = (ty, rx, rz, s, ry = 0) => `perspective(900px) translateY(${ty}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
// Moment (0–1), w którym książka stoi bokiem i podmieniamy grzbiet na okładkę
const TURN = 0.43;
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
    const sw = stage.clientWidth;
    // pozycja „w powietrzu” przed półką: okładka nad miejscem, z którego wyjęto książkę
    const hx = Math.max(0, Math.min(sw - t.w, s.x + s.w / 2 - t.w / 2));
    const hy = s.y + s.h - t.h - 6;
    const edge = { x: s.x + s.w / 2 - 6, y: s.y - 14, w: 12, h: s.h };
    const out = { x: s.x, y: s.y - 14, w: s.w, h: s.h };
    const ease = { lin: "linear", out: "cubic-bezier(.2,.7,.2,1)", inOut: "cubic-bezier(.45,.05,.3,1)", in: "cubic-bezier(.5,0,.75,0)" };
    return [
      // 1. palec przechyla górę grzbietu do siebie
      { ...box(s), transform: T(0, 0, 0, 1), transformOrigin: "50% 100%", offset: 0, easing: ease.out },
      { ...box(s), transform: T(0, -24, 0, 1.02), transformOrigin: "50% 100%", offset: 0.12, easing: ease.inOut },
      // 2. książka wysuwa się z regału w stronę widza
      { ...box(out), transform: T(-4, -6, 0, 1.22), transformOrigin: "50% 100%", offset: 0.27, easing: ease.inOut },
      { ...box(out), transform: T(-10, 0, 0, 1.3), transformOrigin: "50% 50%", offset: 0.34, easing: ease.in },
      // 3. obraca się w powietrzu – najpierw bokiem…
      { ...box(edge), transform: T(-12, 0, 0, 1.3, 90), transformOrigin: "50% 50%", offset: TURN, easing: ease.out },
      // …potem pokazuje okładkę
      { ...box({ x: hx, y: hy, w: t.w, h: t.h }), transform: T(-14, 0, -3, 1.18, 0), transformOrigin: "50% 50%", offset: 0.53, easing: ease.inOut },
      { ...box({ x: hx, y: hy - 8, w: t.w, h: t.h }), transform: T(-18, -4, -6, 1.18), transformOrigin: "50% 60%", offset: 0.62, easing: ease.inOut },
      // 4. leci na stół i kładzie się
      { ...box(t), transform: T(0, LAND_RX + 7, LAND_RZ, 1.03), transformOrigin: "50% 60%", offset: 0.9, easing: ease.out },
      { ...box(t), transform: T(0, LAND_RX, LAND_RZ, 1), transformOrigin: "50% 60%", offset: 1 },
    ];
  }

  function crossfade(f, dur, toCover) {
    const show = [{ opacity: 0 }, { opacity: 0, offset: TURN - 0.005 }, { opacity: 1, offset: TURN + 0.005 }, { opacity: 1 }];
    const hide = [{ opacity: 1 }, { opacity: 1, offset: TURN - 0.005 }, { opacity: 0, offset: TURN + 0.005 }, { opacity: 0 }];
    const o = { duration: dur, fill: "forwards", direction: toCover ? "normal" : "reverse" };
    f.querySelector(".face-cover").animate(show, o);
    f.querySelector(".face-spine").animate(hide, o);
  }

  // Sąsiednie książki chwieją się, gdy jedna zostaje wyciągnięta lub wstawiona
  function wobble(spine, delay) {
    if (reduce()) return;
    const prev = spine.previousElementSibling, next = spine.nextElementSibling;
    const k = (deg) => [{ transform: "rotate(0)" }, { transform: `rotate(${deg}deg)`, offset: 0.35 }, { transform: `rotate(${-deg / 3}deg)`, offset: 0.7 }, { transform: "rotate(0)" }];
    const o = { duration: 650, delay, easing: "ease-out" };
    prev?.animate(k(3), o);
    next?.animate(k(-3), o);
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
    const dur = reduce() ? 1 : 2300;
    const a = f.animate(frames(s, t), { duration: dur, fill: "forwards" });
    crossfade(f, dur, true);
    wobble(spine, dur * 0.2);
    const cur = { b, fly: f, spine };
    current = cur;
    stage.classList.add("has-book");
    setTimeout(() => { if (current === cur) { dust(); renderInfo(b); } }, dur * 0.9);
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
    const dur = reduce() ? 1 : 1700;
    const back = frames(s, t).reverse().map((k) => ({ ...k, offset: 1 - k.offset, easing: "cubic-bezier(.45,.05,.3,1)" }));
    const a = f.animate(back, { duration: dur, fill: "forwards" });
    crossfade(f, dur, false);
    wobble(spine, dur * 0.82);
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
