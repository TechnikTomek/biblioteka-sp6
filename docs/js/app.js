// Wspólne funkcje strony: Firebase (logowanie + baza), nawigacja.
import { firebaseConfig } from "./firebase-config.js";

export const MAX_RESERVATIONS = 3;
export const configured = !String(firebaseConfig.apiKey).startsWith("WKLEJ");

// Firebase ładowany dopiero, gdy jest skonfigurowany – bez niego strona i katalog działają dalej.
const SDK = "https://www.gstatic.com/firebasejs/11.0.2/";
let fb = null, auth = null, db = null;
const ready = (async () => {
  if (!configured) return false;
  try {
    const [app, a, f] = await Promise.all([
      import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js"),
    ]);
    fb = { ...a, ...f };
    const inst = app.initializeApp(firebaseConfig);
    auth = a.getAuth(inst);
    db = f.getFirestore(inst);
    return true;
  } catch (e) {
    console.error("Nie udało się wczytać Firebase", e);
    return false;
  }
})();

const ERRORS = {
  "auth/invalid-credential": "Nieprawidłowy e-mail lub hasło.",
  "auth/wrong-password": "Nieprawidłowy e-mail lub hasło.",
  "auth/user-not-found": "Nieprawidłowy e-mail lub hasło.",
  "auth/invalid-email": "Podaj poprawny adres e-mail.",
  "auth/email-already-in-use": "Konto z tym adresem e-mail już istnieje.",
  "auth/weak-password": "Hasło musi mieć co najmniej 8 znaków.",
  "auth/too-many-requests": "Zbyt wiele prób. Spróbuj ponownie za kilka minut.",
  "auth/network-request-failed": "Brak połączenia z internetem.",
  "permission-denied": "Brak uprawnień do tej operacji.",
};
export const errorText = (e) => ERRORS[e?.code] || e?.message || "Wystąpił błąd. Spróbuj ponownie.";

async function need() {
  if (!configured) throw new Error("Logowanie nie jest jeszcze skonfigurowane (brak konfiguracji Firebase w js/firebase-config.js).");
  if (!(await ready)) throw new Error("Nie udało się połączyć z usługą logowania. Sprawdź połączenie z internetem.");
}

// ---------- Użytkownik ----------
async function loadProfile(fbUser) {
  if (!fbUser) return null;
  const snap = await fb.getDoc(fb.doc(db, "users", fbUser.uid));
  if (!snap.exists()) return null;
  const p = snap.data();
  let librarian = false;
  try { librarian = (await fb.getDoc(fb.doc(db, "librarians", fbUser.email.toLowerCase()))).exists(); } catch {}
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    name: p.name,
    klasa: p.klasa,
    createdAt: p.createdAt?.toDate?.() ?? new Date(),
    role: librarian ? "bibliotekarz" : "czytelnik",
  };
}

export async function getUser() {
  if (!(await ready)) return null;
  return new Promise((resolve) => {
    const stop = fb.onAuthStateChanged(auth, async (u) => {
      stop();
      try { resolve(await loadProfile(u)); } catch { resolve(null); }
    });
  });
}

export async function login(email, password) {
  await need();
  const cred = await fb.signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await loadProfile(cred.user);
  if (!profile) {
    await fb.signOut(auth);
    throw new Error("To konto nie ma ukończonej rejestracji. Zarejestruj się ponownie lub skontaktuj z biblioteką.");
  }
  return profile;
}

export async function register({ name, klasa, email, password, code }) {
  await need();
  name = String(name || "").trim(); klasa = String(klasa || "").trim();
  if (name.length < 3 || name.length > 80) throw new Error("Podaj imię i nazwisko.");
  if (klasa.length > 12) throw new Error("Klasa może mieć maksymalnie 12 znaków.");
  if (String(password).length < 8) throw new Error("Hasło musi mieć co najmniej 8 znaków.");
  const cred = await fb.createUserWithEmailAndPassword(auth, email.trim(), password);
  try {
    await fb.setDoc(fb.doc(db, "users", cred.user.uid), {
      name, klasa, email: cred.user.email, code: String(code || "").trim(), createdAt: fb.serverTimestamp(),
    });
  } catch (e) {
    await cred.user.delete().catch(() => fb.signOut(auth));
    if (e.code === "permission-denied") throw new Error("Nieprawidłowy kod szkoły. Poproś bibliotekarza o kod rejestracji.");
    throw e;
  }
  return loadProfile(cred.user);
}

export async function logout() {
  if (auth) await fb.signOut(auth).catch(() => {});
  location.href = "index.html";
}

// ---------- Rezerwacje ----------
// Każdy czytelnik ma 3 "miejsca" na rezerwacje: dokumenty {uid}_1, {uid}_2, {uid}_3.
// Reguły Firestore pilnują, by nie dało się utworzyć więcej.
const toRes = (d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() ?? new Date() });
const byDate = (a, b) => a.createdAt - b.createdAt;

export async function myReservations(user) {
  const snap = await fb.getDocs(fb.query(fb.collection(db, "reservations"), fb.where("uid", "==", user.uid)));
  return snap.docs.map(toRes).sort(byDate);
}

export async function allReservations() {
  const snap = await fb.getDocs(fb.collection(db, "reservations"));
  return snap.docs.map(toRes).sort(byDate);
}

export async function reserve(user, book) {
  const mine = await myReservations(user);
  if (mine.some((r) => r.bookId === book.id)) throw new Error("Ta książka jest już przez Ciebie zarezerwowana.");
  const used = new Set(mine.map((r) => r.id));
  const slot = [1, 2, 3].find((n) => !used.has(`${user.uid}_${n}`));
  if (!slot) throw new Error(`Możesz mieć maksymalnie ${MAX_RESERVATIONS} rezerwacje naraz.`);
  await fb.setDoc(fb.doc(db, "reservations", `${user.uid}_${slot}`), {
    uid: user.uid, bookId: book.id, title: book.title, author: book.author,
    userName: user.name, klasa: user.klasa, createdAt: fb.serverTimestamp(),
  });
}

export const cancelReservation = (id) => fb.deleteDoc(fb.doc(db, "reservations", id));

// ---------- UI ----------
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderNav(user) {
  const slot = document.getElementById("nav-auth");
  if (!slot) return;
  if (user) {
    slot.innerHTML = `<a href="konto.html" class="btn btn-small">Moje konto</a>
      <button type="button" class="btn btn-small btn-ghost" id="logout-btn">Wyloguj</button>`;
    document.getElementById("logout-btn").addEventListener("click", logout);
  } else {
    slot.innerHTML = `<a href="logowanie.html" class="btn btn-small">Zaloguj się</a>`;
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
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("open"); });
  const page = location.pathname.split("/").pop() || "index.html";
  nav.querySelectorAll("a").forEach((a) => {
    if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
  });
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
setupMenu();
export const userPromise = getUser().then((u) => (renderNav(u), u));
