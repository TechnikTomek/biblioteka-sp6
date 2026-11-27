// ==========================================================
// Biblioteka SP nr 6 – wspólny skrypt strony
// Wersja demonstracyjna: konta i rezerwacje zapisywane są
// wyłącznie w przeglądarce (localStorage). Bez serwera.
// ==========================================================
import { BOOKS, findBook, saveBooks, resetBooks } from "./books.js";

export const MAX_RESERVATIONS = 3;
export const MAX_LOANS = 5;
export const LOAN_DAYS = 14;        // zwykłe książki
export const LOAN_DAYS_LEKTURA = 21; // lektury
export const RENEW_DAYS = 14;
export const MAX_RENEWALS = 1;
export const DEMO_ACCOUNTS = [
  { email: "uczen@sp6.pl", password: "uczen123", name: "Ola Testowa", klasa: "6a", role: "czytelnik" },
  { email: "bibliotekarz@sp6.pl", password: "biblio123", name: "Pani Bibliotekarka", klasa: "", role: "bibliotekarz" },
];

// ---------- Bezpieczny magazyn (localStorage z zapasem w pamięci) ----------
const mem = new Map();
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return mem.has(key) ? mem.get(key) : fallback; }
  },
  set(key, value) {
    mem.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  del(key) { mem.delete(key); try { localStorage.removeItem(key); } catch {} },
};
const K = { users: "sp6_users", session: "sp6_session", res: "sp6_reservations", loans: "sp6_loans", fav: "sp6_favorites", seed: "sp6_seed", theme: "sp6_theme" };
const SEED_VERSION = 3;

async function hash(text) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sp6:" + text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 5381; for (const c of "sp6:" + text) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return "x" + h.toString(16);
  }
}

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

const daysFrom = (iso, n) => new Date(new Date(iso).getTime() + n * 864e5).toISOString();
const OTHER_READERS = [
  { email: "jan@sp6.pl", name: "Jan Kowalski", klasa: "4b" },
  { email: "zosia@sp6.pl", name: "Zosia Nowak", klasa: "7c" },
  { email: "kuba@sp6.pl", name: "Kuba Wiśniewski", klasa: "5a" },
];

async function seed() {
  if (store.get(K.seed, 0) === SEED_VERSION) return;
  const keep = store.get(K.users, []).filter((u) => !u.demo && !OTHER_READERS.some((o) => o.email === u.email));
  const users = [...keep];
  for (const d of DEMO_ACCOUNTS) {
    users.push({ email: d.email, name: d.name, klasa: d.klasa, role: d.role, demo: true, pass: await hash(d.password), createdAt: daysAgo(120) });
  }
  for (const o of OTHER_READERS) {
    users.push({ ...o, role: "czytelnik", demo: true, pass: await hash(Math.random().toString(36)), createdAt: daysAgo(200) });
  }
  store.set(K.users, users);
  store.set(K.res, [
    ...store.get(K.res, []).filter((r) => !r.seed),
    { id: "s1", seed: true, email: "uczen@sp6.pl", userName: "Ola Testowa", klasa: "6a", bookId: "b06", createdAt: daysAgo(1) },
    { id: "s2", seed: true, email: "jan@sp6.pl", userName: "Jan Kowalski", klasa: "4b", bookId: "b03", createdAt: daysAgo(2) },
    { id: "s3", seed: true, email: "zosia@sp6.pl", userName: "Zosia Nowak", klasa: "7c", bookId: "b05", createdAt: daysAgo(6) },
    { id: "s4", seed: true, email: "zosia@sp6.pl", userName: "Zosia Nowak", klasa: "7c", bookId: "b20", createdAt: daysAgo(0) },
  ]);
  const L = (id, email, bookId, fromDays, len, returnedDays = null, renewals = 0) => {
    const u = [...DEMO_ACCOUNTS, ...OTHER_READERS].find((x) => x.email === email);
    const from = daysAgo(fromDays);
    return { id, seed: true, email, userName: u.name, klasa: u.klasa, bookId, from, due: daysFrom(from, len), returned: returnedDays == null ? null : daysAgo(returnedDays), renewals };
  };
  store.set(K.loans, [
    ...store.get(K.loans, []).filter((l) => !l.seed),
    L("l1", "uczen@sp6.pl", "b11", 10, 14),
    L("l2", "uczen@sp6.pl", "b02", 18, 21),
    L("l3", "uczen@sp6.pl", "b09", 90, 21, 75),
    L("l4", "uczen@sp6.pl", "b16", 60, 14, 50),
    L("l5", "uczen@sp6.pl", "b17", 40, 14, 31),
    L("l6", "jan@sp6.pl", "b08", 30, 21),
    L("l7", "zosia@sp6.pl", "b13", 5, 21),
    L("l8", "kuba@sp6.pl", "b19", 12, 14, null, 1),
    L("l9", "kuba@sp6.pl", "b01", 120, 21, 100),
  ]);
  const fav = store.get(K.fav, {});
  fav["uczen@sp6.pl"] ??= ["b04", "b22"];
  store.set(K.fav, fav);
  store.set(K.seed, SEED_VERSION);
}
const seeded = seed();

export async function resetDemo() {
  for (const k of [K.users, K.session, K.res, K.loans, K.fav, K.seed]) store.del(k);
  resetBooks();
  await seed();
}

// ---------- Konta ----------
const pub = (u) => u && ({ email: u.email, name: u.name, klasa: u.klasa, role: u.role || "czytelnik", demo: !!u.demo, createdAt: u.createdAt });
const findUser = (email) => store.get(K.users, []).find((u) => u.email === email);

export async function getUser() {
  await seeded;
  const email = store.get(K.session, null);
  return email ? pub(findUser(email)) : null;
}

export async function login(email, password) {
  await seeded;
  email = String(email || "").trim().toLowerCase();
  const u = findUser(email);
  if (!u || u.pass !== (await hash(String(password || "")))) throw new Error("Nieprawidłowy e-mail lub hasło.");
  store.set(K.session, u.email);
  return pub(u);
}

export async function register({ name, klasa, email, password }) {
  await seeded;
  name = String(name || "").trim(); klasa = String(klasa || "").trim(); email = String(email || "").trim().toLowerCase();
  if (name.length < 3) throw new Error("Podaj imię i nazwisko.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Podaj poprawny adres e-mail.");
  if (String(password || "").length < 6) throw new Error("Hasło musi mieć co najmniej 6 znaków.");
  if (findUser(email)) throw new Error("Konto z tym adresem e-mail już istnieje.");
  const u = { email, name: name.slice(0, 80), klasa: klasa.slice(0, 12), role: "czytelnik", pass: await hash(password), createdAt: new Date().toISOString() };
  store.set(K.users, [...store.get(K.users, []), u]);
  store.set(K.session, email);
  return pub(u);
}

export function logout() {
  store.del(K.session);
  sessionStorage?.setItem?.("sp6_toast", "Wylogowano. Do zobaczenia!");
  location.href = "index.html";
}

// ---------- Rezerwacje ----------
export const allReservations = () => store.get(K.res, []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
export const myReservations = (user) => allReservations().filter((r) => r.email === user.email);
export const reservedCount = (bookId) => store.get(K.res, []).filter((r) => r.bookId === bookId).length;
export const loanedCount = (bookId) => store.get(K.loans, []).filter((l) => l.bookId === bookId && !l.returned).length;
export const available = (book) => Math.max(0, book.copies - reservedCount(book.id) - loanedCount(book.id));

export function reserve(user, bookId) {
  const book = findBook(bookId);
  if (!book) throw new Error("Nie znaleziono książki.");
  if (myLoans(user).some((l) => l.bookId === bookId)) throw new Error("Masz już tę książkę wypożyczoną.");
  const mine = myReservations(user);
  if (mine.some((r) => r.bookId === bookId)) throw new Error("Ta książka jest już przez Ciebie zarezerwowana.");
  if (mine.length >= MAX_RESERVATIONS) throw new Error(`Możesz mieć maksymalnie ${MAX_RESERVATIONS} rezerwacje naraz.`);
  if (available(book) < 1) throw new Error("Brak wolnych egzemplarzy tej książki.");
  const r = { id: Math.random().toString(36).slice(2, 10), email: user.email, userName: user.name, klasa: user.klasa, bookId, createdAt: new Date().toISOString() };
  store.set(K.res, [...store.get(K.res, []), r]);
  return r;
}

export function cancelReservation(user, id) {
  const list = store.get(K.res, []);
  const r = list.find((x) => x.id === id);
  if (!r) throw new Error("Nie znaleziono rezerwacji.");
  if (r.email !== user.email && user.role !== "bibliotekarz") throw new Error("Brak uprawnień.");
  store.set(K.res, list.filter((x) => x.id !== id));
}

/** Termin odbioru: 5 dni roboczych od rezerwacji. */
export function pickupDeadline(iso) {
  const d = new Date(iso); let n = 0;
  while (n < 5) { d.setDate(d.getDate() + 1); if (d.getDay() % 6 !== 0) n++; }
  return d;
}

// ---------- Wypożyczenia ----------
const DAY = 864e5;
export const allLoans = () => store.get(K.loans, []).slice().sort((a, b) => b.from.localeCompare(a.from));
export const activeLoans = () => allLoans().filter((l) => !l.returned).sort((a, b) => a.due.localeCompare(b.due));
export const myLoans = (user) => activeLoans().filter((l) => l.email === user.email);
export const myHistory = (user) => allLoans().filter((l) => l.email === user.email && l.returned);
export const daysLeft = (loan) => Math.ceil((new Date(loan.due).setHours(23, 59, 59) - Date.now()) / DAY);
export const isOverdue = (loan) => !loan.returned && daysLeft(loan) < 0;
export const loanDays = (book) => (book?.category?.startsWith("lektura") ? LOAN_DAYS_LEKTURA : LOAN_DAYS);

export function canRenew(loan) {
  if (loan.returned) return "Książka została już zwrócona.";
  if (isOverdue(loan)) return "Nie można prolongować – termin zwrotu minął.";
  if ((loan.renewals || 0) >= MAX_RENEWALS) return "Wykorzystano już prolongatę.";
  if (reservedCount(loan.bookId) > 0 && available(findBook(loan.bookId) || { copies: 0 }) < 1) return "Ktoś czeka na tę książkę – prolongata niemożliwa.";
  return "";
}

function saveLoan(id, patch) {
  const list = store.get(K.loans, []);
  const i = list.findIndex((l) => l.id === id);
  if (i < 0) throw new Error("Nie znaleziono wypożyczenia.");
  list[i] = { ...list[i], ...patch };
  store.set(K.loans, list);
  return list[i];
}

export function renewLoan(user, id) {
  const loan = store.get(K.loans, []).find((l) => l.id === id);
  if (!loan) throw new Error("Nie znaleziono wypożyczenia.");
  if (loan.email !== user.email && user.role !== "bibliotekarz") throw new Error("Brak uprawnień.");
  const why = canRenew(loan);
  if (why) throw new Error(why);
  return saveLoan(id, { due: new Date(new Date(loan.due).getTime() + RENEW_DAYS * DAY).toISOString(), renewals: (loan.renewals || 0) + 1 });
}

export function returnLoan(user, id) {
  if (user.role !== "bibliotekarz") throw new Error("Zwrot przyjmuje bibliotekarz.");
  return saveLoan(id, { returned: new Date().toISOString() });
}

/** Bibliotekarz wypożycza książkę czytelnikowi (opcjonalnie realizując jego rezerwację). */
export function lendBook(user, readerEmail, bookId, fromReservationId = null) {
  if (user.role !== "bibliotekarz") throw new Error("Brak uprawnień.");
  const reader = findUser(readerEmail);
  const book = findBook(bookId);
  if (!reader) throw new Error("Wybierz czytelnika.");
  if (!book) throw new Error("Wybierz książkę.");
  const res = store.get(K.res, []);
  const r = fromReservationId ? res.find((x) => x.id === fromReservationId) : null;
  if (!r && available(book) < 1) throw new Error("Brak wolnych egzemplarzy tej książki.");
  if (activeLoans().some((l) => l.email === reader.email && l.bookId === bookId)) throw new Error("Czytelnik ma już tę książkę.");
  if (activeLoans().filter((l) => l.email === reader.email).length >= MAX_LOANS) throw new Error(`Czytelnik ma już ${MAX_LOANS} wypożyczeń.`);
  const from = new Date().toISOString();
  const loan = { id: "w" + Math.random().toString(36).slice(2, 9), email: reader.email, userName: reader.name, klasa: reader.klasa, bookId,
    from, due: new Date(Date.now() + loanDays(book) * DAY).toISOString(), returned: null, renewals: 0 };
  store.set(K.loans, [...store.get(K.loans, []), loan]);
  if (r) store.set(K.res, res.filter((x) => x.id !== r.id));
  return loan;
}

export function readers() {
  return store.get(K.users, []).filter((u) => u.role !== "bibliotekarz").map(pub).sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

// ---------- Książki (bibliotekarz) ----------
const CAT_KEYS = ["lektura-1-3", "lektura-4-6", "lektura-7-8", "popularne"];
function cleanBook(data) {
  const b = {
    title: String(data.title || "").trim().slice(0, 150),
    author: String(data.author || "").trim().slice(0, 100),
    year: Number(data.year),
    category: CAT_KEYS.includes(data.category) ? data.category : "popularne",
    copies: Math.floor(Number(data.copies)),
    isNew: data.isNew === true || data.isNew === "on" || data.isNew === "true",
    desc: String(data.desc || "").trim().slice(0, 600),
    color: /^#[0-9a-f]{6}$/i.test(data.color || "") ? data.color : undefined,
  };
  if (b.title.length < 2) throw new Error("Podaj tytuł.");
  if (b.author.length < 3) throw new Error("Podaj autora.");
  if (!Number.isFinite(b.year) || b.year < 1400 || b.year > new Date().getFullYear() + 1) throw new Error("Podaj poprawny rok wydania.");
  if (!Number.isFinite(b.copies) || b.copies < 1 || b.copies > 500) throw new Error("Liczba egzemplarzy: od 1 do 500.");
  return b;
}

export function addBook(user, data) {
  if (user.role !== "bibliotekarz") throw new Error("Brak uprawnień.");
  const b = cleanBook(data);
  const n = Math.max(0, ...BOOKS.map((x) => Number(String(x.id).replace(/\D/g, "")) || 0)) + 1;
  const book = { id: "b" + String(n).padStart(2, "0"), ...b };
  BOOKS.push(book);
  saveBooks();
  return book;
}

export function updateBook(user, id, data) {
  if (user.role !== "bibliotekarz") throw new Error("Brak uprawnień.");
  const book = findBook(id);
  if (!book) throw new Error("Nie znaleziono książki.");
  const b = cleanBook(data);
  const busy = loanedCount(id) + reservedCount(id);
  if (b.copies < busy) throw new Error(`Nie można zmniejszyć liczby egzemplarzy poniżej ${busy} (wypożyczone + zarezerwowane).`);
  Object.assign(book, b);
  saveBooks();
  return book;
}

export function deleteBook(user, id) {
  if (user.role !== "bibliotekarz") throw new Error("Brak uprawnień.");
  if (loanedCount(id) > 0) throw new Error("Nie można usunąć – książka jest wypożyczona.");
  if (reservedCount(id) > 0) throw new Error("Nie można usunąć – książka ma rezerwacje.");
  const i = BOOKS.findIndex((b) => b.id === id);
  if (i < 0) throw new Error("Nie znaleziono książki.");
  BOOKS.splice(i, 1);
  saveBooks();
  const fav = store.get(K.fav, {});
  for (const k of Object.keys(fav)) fav[k] = fav[k].filter((x) => x !== id);
  store.set(K.fav, fav);
}

// ---------- Ulubione ----------
export const getFavorites = (user) => (user ? (store.get(K.fav, {})[user.email] || []).filter((id) => findBook(id)) : []);
export function toggleFavorite(user, bookId) {
  const all = store.get(K.fav, {});
  const list = new Set(all[user.email] || []);
  list.has(bookId) ? list.delete(bookId) : list.add(bookId);
  all[user.email] = [...list];
  store.set(K.fav, all);
  return list.has(bookId);
}

// ---------- Narzędzia UI ----------
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export const fmtDate = (d) => new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
export const fmtShort = (d) => new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
export const initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function toast(text, type = "") {
  // Gdy otwarte jest okno <dialog>, toast musi być w nim (warstwa wierzchnia), inaczej przykryje go tło.
  const host = document.querySelector("dialog[open]") || document.body;
  let box = host.querySelector(":scope > .toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("aria-live", "polite"); host.append(box); }
  const t = document.createElement("div");
  t.className = "toast " + type; t.textContent = text;
  box.append(t);
  setTimeout(() => { t.classList.add("out"); t.addEventListener("animationend", () => t.remove(), { once: true }); }, 3200);
}

export function observeReveal(root = document) {
  const els = root.querySelectorAll(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((e) => io.observe(e));
}

export function countUp(el) {
  const target = Number(el.dataset.count); const dur = 1400; const start = performance.now();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const step = (now) => {
    const p = reduce ? 1 : Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("pl-PL") + (el.dataset.suffix || "");
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- Motyw ----------
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const isDark = () => document.documentElement.dataset.theme === "dark" ||
  (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; }
applyTheme(store.get(K.theme, null));

function setupTheme() {
  const btn = document.getElementById("theme-btn");
  if (!btn) return;
  const paint = () => { btn.innerHTML = isDark() ? SUN : MOON; btn.setAttribute("aria-label", isDark() ? "Włącz jasny motyw" : "Włącz ciemny motyw"); };
  paint();
  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    applyTheme(next); store.set(K.theme, next); paint();
  });
}

// ---------- Nawigacja ----------
function renderNav(user) {
  const slot = document.getElementById("nav-auth");
  if (!slot) return;
  if (user) {
    slot.innerHTML = `<a href="konto.html" class="btn btn-small"><span class="avatar">${esc(initials(user.name))}</span>Moje konto</a>
      <button type="button" class="btn btn-small btn-ghost" id="logout-btn">Wyloguj</button>`;
    document.getElementById("logout-btn").addEventListener("click", logout);
  } else {
    slot.innerHTML = `<a href="logowanie.html" class="btn btn-small">Zaloguj się</a>`;
  }
}

function setupChrome() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("open"); });
    const page = location.pathname.split("/").pop() || "index.html";
    nav.querySelectorAll(":scope > a").forEach((a) => { if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page"); });
  }

  const header = document.querySelector(".site-header");
  const bar = document.querySelector(".progress");
  const top = document.querySelector(".to-top");
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    header?.classList.toggle("scrolled", y > 8);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    top?.classList.toggle("show", y > 600);
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  top?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  const pending = sessionStorage?.getItem?.("sp6_toast");
  if (pending) { sessionStorage.removeItem("sp6_toast"); setTimeout(() => toast(pending), 300); }
}

// Karty lekko przechylają się za kursorem
function setupTilt() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest?.(".card.lift");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-6px)`;
    c.onpointerleave = () => { c.style.transform = ""; };
  });
}

document.documentElement.classList.remove("no-js");
setupTilt();
setupChrome();
setupTheme();
observeReveal();
export const userPromise = getUser().then((u) => (renderNav(u), u));
