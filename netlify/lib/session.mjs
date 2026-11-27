import crypto from "node:crypto";

const COOKIE = "sp6_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dni

export class ConfigError extends Error {}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new ConfigError("Brak zmiennej środowiskowej SESSION_SECRET (min. 16 znaków) – ustaw ją w panelu Netlify.");
  }
  return s;
}

const hmac = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

export function sign(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verify(token) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

export function getSession(req) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return verify(m?.[1]);
}

export const sessionCookie = (token) =>
  `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
export const clearCookie = `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const userKey = (email) => crypto.createHash("sha256").update(email).digest("hex");

export function isLibrarian(email) {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export const publicUser = (u) => ({
  name: u.name,
  email: u.email,
  klasa: u.klasa,
  role: isLibrarian(u.email) ? "bibliotekarz" : "czytelnik",
  createdAt: u.createdAt,
});

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await new Promise((res, rej) =>
    crypto.scrypt(password, salt, 64, (err, key) => (err ? rej(err) : res(key)))
  );
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function checkPassword(password, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const hash = await new Promise((res, rej) =>
    crypto.scrypt(password, Buffer.from(saltHex, "hex"), 64, (err, key) => (err ? rej(err) : res(key)))
  );
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

export function isJson(req) {
  return (req.headers.get("content-type") || "").includes("application/json");
}

export function errorResponse(e) {
  console.error(e);
  return json({ error: e instanceof ConfigError ? e.message : "Błąd serwera. Spróbuj ponownie później." }, 500);
}
