import { getStore } from "@netlify/blobs";
import {
  json, sign, getSession, sessionCookie, clearCookie, userKey, publicUser,
  hashPassword, checkPassword, isJson, errorResponse,
} from "../lib/session.mjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req, context) => {
  try {
    const action = context.params?.action ?? new URL(req.url).pathname.split("/").pop();
    const users = getStore({ name: "users", consistency: "strong" });

    if (action === "me" && req.method === "GET") {
      const s = getSession(req);
      if (!s) return json({ user: null });
      const u = await users.get(userKey(s.email), { type: "json" });
      if (!u) return json({ user: null }, 200, { "set-cookie": clearCookie });
      return json({ user: publicUser(u) });
    }

    if (req.method !== "POST") return json({ error: "Metoda niedozwolona" }, 405);
    if (action === "logout") return json({ ok: true }, 200, { "set-cookie": clearCookie });
    if (!isJson(req)) return json({ error: "Nieprawidłowe żądanie" }, 415);

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Nieprawidłowe dane" }, 400);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (action === "register") {
      const name = String(body.name || "").trim().slice(0, 80);
      const klasa = String(body.klasa || "").trim().slice(0, 12);
      const requiredCode = process.env.REGISTRATION_CODE;
      if (requiredCode && String(body.code || "").trim() !== requiredCode) {
        return json({ error: "Nieprawidłowy kod szkoły. Poproś bibliotekarza o kod rejestracji." }, 403);
      }
      if (name.length < 3) return json({ error: "Podaj imię i nazwisko." }, 400);
      if (!EMAIL_RE.test(email) || email.length > 120) return json({ error: "Podaj poprawny adres e-mail." }, 400);
      if (password.length < 8 || password.length > 200) return json({ error: "Hasło musi mieć co najmniej 8 znaków." }, 400);

      const key = userKey(email);
      if (await users.get(key)) return json({ error: "Konto z tym adresem e-mail już istnieje." }, 409);

      const user = { name, email, klasa, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
      await users.setJSON(key, user);
      return json({ user: publicUser(user) }, 201, { "set-cookie": sessionCookie(sign({ email })) });
    }

    if (action === "login") {
      const u = EMAIL_RE.test(email) ? await users.get(userKey(email), { type: "json" }) : null;
      if (!u || !(await checkPassword(password, u.passwordHash))) {
        return json({ error: "Nieprawidłowy e-mail lub hasło." }, 401);
      }
      return json({ user: publicUser(u) }, 200, { "set-cookie": sessionCookie(sign({ email })) });
    }

    return json({ error: "Nie znaleziono" }, 404);
  } catch (e) {
    return errorResponse(e);
  }
};

export const config = { path: "/api/auth/:action" };
