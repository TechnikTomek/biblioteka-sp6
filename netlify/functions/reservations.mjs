import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { BOOKS } from "../../public/js/books.js";
import { json, getSession, userKey, isLibrarian, isJson, errorResponse } from "../lib/session.mjs";

const MAX_RESERVATIONS = 3;

export default async (req) => {
  try {
    const s = getSession(req);
    if (!s) return json({ error: "Musisz być zalogowany." }, 401);

    const users = getStore({ name: "users", consistency: "strong" });
    const me = await users.get(userKey(s.email), { type: "json" });
    if (!me) return json({ error: "Musisz być zalogowany." }, 401);

    const store = getStore({ name: "reservations", consistency: "strong" });
    const myKey = userKey(me.email);
    const librarian = isLibrarian(me.email);
    const load = async (k) => (await store.get(k, { type: "json" })) || [];
    const url = new URL(req.url);

    if (req.method === "GET") {
      if (url.searchParams.get("all") === "1") {
        if (!librarian) return json({ error: "Brak uprawnień." }, 403);
        const { blobs } = await store.list();
        const all = [];
        for (const b of blobs) {
          for (const r of await load(b.key)) all.push({ ...r, owner: b.key });
        }
        all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return json({ reservations: all });
      }
      return json({ reservations: await load(myKey) });
    }

    if (req.method === "POST") {
      if (!isJson(req)) return json({ error: "Nieprawidłowe żądanie" }, 415);
      const { bookId } = (await req.json().catch(() => ({}))) || {};
      const book = BOOKS.find((b) => b.id === bookId);
      if (!book) return json({ error: "Nie znaleziono książki." }, 400);
      const list = await load(myKey);
      if (list.some((r) => r.bookId === book.id)) return json({ error: "Ta książka jest już przez Ciebie zarezerwowana." }, 409);
      if (list.length >= MAX_RESERVATIONS) return json({ error: `Możesz mieć maksymalnie ${MAX_RESERVATIONS} rezerwacje naraz.` }, 409);
      const r = {
        id: crypto.randomUUID(),
        bookId: book.id,
        title: book.title,
        author: book.author,
        userName: me.name,
        klasa: me.klasa,
        createdAt: new Date().toISOString(),
      };
      list.push(r);
      await store.setJSON(myKey, list);
      return json({ reservation: r }, 201);
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      const owner = url.searchParams.get("owner");
      let target = myKey;
      if (owner && owner !== myKey) {
        if (!librarian || !/^[a-f0-9]{64}$/.test(owner)) return json({ error: "Brak uprawnień." }, 403);
        target = owner;
      }
      const list = await load(target);
      const next = list.filter((r) => r.id !== id);
      if (next.length === list.length) return json({ error: "Nie znaleziono rezerwacji." }, 404);
      if (next.length) await store.setJSON(target, next);
      else await store.delete(target);
      return json({ ok: true });
    }

    return json({ error: "Metoda niedozwolona" }, 405);
  } catch (e) {
    return errorResponse(e);
  }
};

export const config = { path: "/api/reservations" };
