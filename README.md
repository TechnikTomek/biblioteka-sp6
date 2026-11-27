# Biblioteka SP nr 6 im. Michała Elwiro Andriollego

Strona biblioteki szkolnej z systemem kont czytelników i rezerwacji książek.
Działa w całości na Netlify: strony statyczne + Netlify Functions + Netlify Blobs (baza kont i rezerwacji). Nie potrzeba zewnętrznej bazy danych.

## Struktura
- `public/` – strony: `index.html`, `katalog.html`, `logowanie.html`, `konto.html`
- `public/js/books.js` – **lista książek** (tu dodajesz / usuwasz pozycje)
- `netlify/functions/auth.mjs` – rejestracja, logowanie, wylogowanie, sesja (`/api/auth/*`)
- `netlify/functions/reservations.mjs` – rezerwacje (`/api/reservations`)
- `netlify/lib/session.mjs` – hasła (scrypt) i podpisane ciasteczko sesji (HttpOnly)

## Wdrożenie na Netlify
1. Wrzuć folder do repozytorium na GitHubie (albo użyj Netlify CLI: `netlify deploy --prod`).
   Uwaga: zwykłe „przeciągnij i upuść” folderu NIE zbuduje funkcji – użyj GitHuba lub CLI.
2. W Netlify: **Add new site → Import an existing project** → wybierz repozytorium.
   Ustawienia budowania wczytają się z `netlify.toml` (publish: `public`).
3. **Site configuration → Environment variables** – dodaj:
   | Zmienna | Opis |
   |---|---|
   | `SESSION_SECRET` | **wymagana** – długi losowy ciąg (min. 16 znaków), np. z `openssl rand -hex 32` |
   | `ADMIN_EMAILS` | e-maile bibliotekarzy, po przecinku – widzą panel ze wszystkimi rezerwacjami |
   | `REGISTRATION_CODE` | opcjonalnie – kod szkoły wymagany przy rejestracji (gdy pusty, każdy może się zarejestrować) |
4. Po dodaniu zmiennych zrób **Deploys → Trigger deploy**.
5. Bibliotekarz zakłada konto zwykłą rejestracją, używając e-maila z `ADMIN_EMAILS`.

## Uruchomienie lokalne
```
npm install
npx netlify-cli dev
```

## Do uzupełnienia
W `public/index.html` w sekcji „Kontakt” wpisz adres, telefon i e-mail biblioteki; godziny otwarcia i regulamin dopasuj do swojej szkoły.
