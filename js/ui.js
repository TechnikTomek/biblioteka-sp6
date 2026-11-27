import { BOOKS, CATEGORIES, findBook } from "./books.js";
import { esc, available, reserve, toggleFavorite, getFavorites, myReservations, myLoans, loanDays, toast, MAX_RESERVATIONS } from "./app.js";

const PALETTE = ["#8b3a14", "#1f4e5f", "#4a5d23", "#6b2d5c", "#7a5a12", "#2f3e6b", "#7b2e2e", "#285c4d"];
const ORN = '<svg class="orn" viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="3"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="26"/><path d="M50 10v80M10 50h80M22 22l56 56M78 22 22 78"/></svg>';
export const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.2 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.9 3.7 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg>';

/** Kolor okładki: własny kolor książki albo stały kolor wyliczony z jej id. */
export function coverColor(x) {
  const book = typeof x === "string" ? findBook(x) : x;
  if (book?.color) return book.color;
  const id = typeof x === "string" ? x : x.id;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const cover = (b) => `<div class="book-cover" style="background:${coverColor(b)}">${ORN}
  <span class="t">${esc(b.title)}</span><span class="a">${esc(b.author)}</span></div>`;

/**
 * Książka 3D: okładka, grzbiet, kartki (bok, góra, dół) i tył.
 * size: szerokość, wysokość, grubość w px.
 */
export function book3d(b, { w = 150, h = 212, d = 28, cls = "" } = {}) {
  const c = coverColor(b);
  return `<div class="b3 ${cls}" style="--c:${c};--w:${w}px;--h:${h}px;--d:${d}px">
    <div class="b3-inner">
      <div class="b3-face b3-front">${cover(b)}</div>
      <div class="b3-face b3-back"></div>
      <div class="b3-face b3-spine"><span>${esc(b.title)}</span></div>
      <div class="b3-face b3-pages"></div>
      <div class="b3-face b3-top"></div>
      <div class="b3-face b3-bottom"></div>
    </div>
    <div class="b3-shadow"></div>
  </div>`;
}

/** Książka 3D obraca się za kursorem / palcem. */
export function tiltFollow(el) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const inner = el.querySelector(".b3-inner");
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width - 0.5) * 2, py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    inner.style.transform = `rotateY(${-22 + px * 34}deg) rotateX(${6 - py * 14}deg)`;
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", () => { inner.style.transform = ""; });
}

/** Miniatura okładki leci do przycisku „Moje konto” po rezerwacji. */
export function flyToAccount(fromEl, b) {
  const target = document.querySelector("#nav-auth .btn");
  if (!fromEl || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = fromEl.getBoundingClientRect(), t = target.getBoundingClientRect();
  const m = document.createElement("div");
  m.className = "fly-mini";
  m.style.cssText = `left:${a.left + a.width / 2 - 20}px;top:${a.top + a.height / 2 - 28}px;background:${coverColor(b)}`;
  document.body.append(m);
  const dx = t.left + t.width / 2 - (a.left + a.width / 2), dy = t.top + t.height / 2 - (a.top + a.height / 2);
  m.animate([
    { transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 },
    { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 120}px) scale(1.2) rotate(-20deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(-40deg)`, opacity: 0.4 },
  ], { duration: 900, easing: "cubic-bezier(.5,0,.3,1)" }).finished.then(() => {
    m.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 350, easing: "ease-out" });
  });
}

export function availTag(b) {
  const n = available(b);
  return n > 0 ? `<span class="tag avail">Dostępna: ${n}</span>` : `<span class="tag none">Brak wolnych</span>`;
}

/** ctx: { user, reserved:Set, favs:Set } */
export function reserveButton(b, ctx) {
  if (!ctx.user) return `<a class="btn btn-small btn-ghost" href="logowanie.html?next=katalog.html">Zaloguj, by rezerwować</a>`;
  if (ctx.loaned?.has(b.id)) return `<button class="btn btn-small btn-ghost" disabled>Wypożyczona ✓</button>`;
  if (ctx.reserved.has(b.id)) return `<button class="btn btn-small btn-ghost" disabled>Zarezerwowano ✓</button>`;
  if (available(b) < 1) return `<button class="btn btn-small btn-ghost" disabled>Brak egzemplarzy</button>`;
  return `<button class="btn btn-small" data-reserve="${b.id}">Zarezerwuj</button>`;
}

export function bookCard(b, ctx = { user: null, reserved: new Set(), favs: new Set() }, i = 0) {
  const fav = ctx.user ? `<button class="fav ${ctx.favs.has(b.id) ? "on" : ""}" data-fav="${b.id}" aria-pressed="${ctx.favs.has(b.id)}" aria-label="Dodaj do ulubionych">${HEART}</button>` : "";
  return `<article class="book card-book reveal" style="--d:${Math.min(i, 8) * 0.05}s">
    <div class="b3-stage" data-open="${b.id}" role="button" tabindex="0" aria-label="Szczegóły: ${esc(b.title)}">${book3d(b)}</div>
    <div class="tags"><span class="tag">${esc(CATEGORIES[b.category])}</span>${b.isNew ? '<span class="tag new">Nowość</span>' : ""}${availTag(b)}</div>
    <div><div class="book-title">${esc(b.title)}</div><div class="book-meta">${esc(b.author)} · ${b.year}</div></div>
    <div class="book-actions">${reserveButton(b, ctx)}${fav}</div>
  </article>`;
}

/** Okno szczegółów książki + obsługa kliknięć rezerwacji/ulubionych w kontenerze. */
export function wireBooks(container, ctx, rerender) {
  let dlg = document.getElementById("book-dialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "book-dialog"; dlg.className = "modal";
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
  }

  const open = (id) => {
    const b = findBook(id);
    if (!b) return;
    dlg.innerHTML = `<button class="icon-btn modal-close" data-close aria-label="Zamknij">✕</button>
      <div class="modal-body">
        <div class="b3-stage b3-big">${book3d(b, { w: 200, h: 284, d: 36 })}</div>
        <div>
          <div class="tags" style="margin-bottom:10px"><span class="tag">${esc(CATEGORIES[b.category])}</span>${b.isNew ? '<span class="tag new">Nowość</span>' : ""}${availTag(b)}</div>
          <h2 style="margin-bottom:.2em">${esc(b.title)}</h2>
          <p class="muted" style="margin-bottom:.4em">${esc(b.author)}</p>
          <p>${esc(b.desc || "")}</p>
          <dl><dt>Rok wydania</dt><dd>${b.year}</dd><dt>Egzemplarze</dt><dd>${b.copies} (wolne: ${available(b)})</dd><dt>Wypożyczenie</dt><dd>${loanDays(b)} dni</dd><dt>Sygnatura</dt><dd>SP6/${b.id.toUpperCase()}</dd></dl>
          <div class="book-actions">${reserveButton(b, ctx)}${ctx.user ? `<button class="fav ${ctx.favs.has(b.id) ? "on" : ""}" data-fav="${b.id}" aria-label="Ulubione">${HEART}</button>` : ""}</div>
        </div>
      </div>`;
    if (!dlg.open) dlg.showModal();
    tiltFollow(dlg.querySelector(".b3-big"));
  };

  const handle = (e) => {
    const r = e.target.closest("[data-reserve]");
    const f = e.target.closest("[data-fav]");
    const o = e.target.closest("[data-open]");
    if (r) {
      try {
        reserve(ctx.user, r.dataset.reserve);
        ctx.reserved.add(r.dataset.reserve);
        flyToAccount(r.closest(".book, .modal-body")?.querySelector(".b3") || r, findBook(r.dataset.reserve));
        const left = MAX_RESERVATIONS - myReservations(ctx.user).length;
        toast(`📚 Zarezerwowano! Odbierz książkę w ciągu 5 dni roboczych.${left ? ` Zostało miejsc: ${left}.` : ""}`);
        rerender();
        if (dlg.open) open(r.dataset.reserve);
      } catch (err) { toast(err.message, "error"); }
    } else if (f) {
      const on = toggleFavorite(ctx.user, f.dataset.fav);
      on ? ctx.favs.add(f.dataset.fav) : ctx.favs.delete(f.dataset.fav);
      document.querySelectorAll(`[data-fav="${f.dataset.fav}"]`).forEach((el) => { el.classList.toggle("on", on); el.setAttribute("aria-pressed", on); });
      toast(on ? "❤️ Dodano do ulubionych" : "Usunięto z ulubionych");
    } else if (o) {
      open(o.dataset.open);
    }
  };
  container.addEventListener("click", handle);
  container.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open]")) { e.preventDefault(); open(e.target.dataset.open); } });
  dlg.addEventListener("click", (e) => { if (!e.target.closest("[data-close]") && e.target !== dlg) handle(e); });
  return { open };
}

export function makeCtx(user) {
  return {
    user,
    reserved: new Set(user ? myReservations(user).map((r) => r.bookId) : []),
    loaned: new Set(user ? myLoans(user).map((l) => l.bookId) : []),
    favs: new Set(getFavorites(user)),
  };
}
