// Wspólne funkcje strony: sesja, wywołania API, nawigacja.
export async function getUser() {
  try {
    const r = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()).user;
  } catch {
    return null;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Błąd (${r.status})`);
  return data;
}

export async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  location.href = "/";
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderNav(user) {
  const slot = document.getElementById("nav-auth");
  if (!slot) return;
  if (user) {
    slot.innerHTML = `<a href="/konto.html" class="btn btn-small">Moje konto</a>
      <button type="button" class="btn btn-small btn-ghost" id="logout-btn">Wyloguj</button>`;
    document.getElementById("logout-btn").addEventListener("click", logout);
  } else {
    slot.innerHTML = `<a href="/logowanie.html" class="btn btn-small">Zaloguj się</a>`;
  }
}

function setupMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  const here = location.pathname.replace(/\/$/, "/index.html");
  nav.querySelectorAll("a").forEach((a) => {
    if (a.getAttribute("href") === here || (here === "/index.html" && a.getAttribute("href") === "/")) a.setAttribute("aria-current", "page");
  });
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
setupMenu();
export const userPromise = getUser().then((u) => (renderNav(u), u));
