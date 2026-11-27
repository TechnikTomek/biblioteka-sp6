# Biblioteka SP nr 6 im. Michała Elwiro Andriollego

Strona biblioteki szkolnej z kontami czytelników i rezerwacjami książek online.
Strona jest w pełni statyczna (folder `docs/`) – działa na **GitHub Pages** (i na Netlify).
Logowanie i baza rezerwacji: **Firebase** (Authentication + Firestore, darmowy plan Spark).

## Struktura
- `docs/` – strona: `index.html`, `katalog.html`, `logowanie.html`, `konto.html`
- `docs/js/books.js` – **lista książek** (tu dodajesz / usuwasz pozycje)
- `docs/js/firebase-config.js` – **konfiguracja Firebase do uzupełnienia**
- `docs/js/app.js` – logowanie, rejestracja, rezerwacje
- `firestore.rules` – reguły bezpieczeństwa bazy (do wklejenia w konsoli Firebase)

## 1. Firebase (ok. 5 minut)
1. Wejdź na https://console.firebase.google.com → **Dodaj projekt** (np. `biblioteka-sp6`, Google Analytics można wyłączyć).
2. **Authentication → Rozpocznij → Metoda logowania → E-mail/hasło → Włącz → Zapisz.**
3. **Authentication → Ustawienia → Autoryzowane domeny → Dodaj domenę:** `techniktomek.github.io`
4. **Firestore Database → Utwórz bazę danych** → lokalizacja `eur3 (europe-west)` → tryb produkcyjny.
5. **Firestore → Reguły** → usuń zawartość, wklej cały plik `firestore.rules` → **Opublikuj**.
6. **Ustawienia projektu (⚙️) → Twoje aplikacje → ikona `</>` (aplikacja internetowa)** → zarejestruj aplikację →
   skopiuj obiekt `firebaseConfig` i wklej jego wartości do `docs/js/firebase-config.js`.
   (Te dane nie są tajne – bezpieczeństwo zapewniają reguły Firestore.)

### Bibliotekarz
W **Firestore → Dane → Rozpocznij kolekcję**: ID kolekcji `librarians`, ID dokumentu = e-mail bibliotekarza
**małymi literami** (np. `bibliotekarz@szkola.pl`), dodaj dowolne pole (np. `aktywny` = `true`).
Bibliotekarz zakłada konto zwykłą rejestracją na stronie i w „Moje konto” widzi wszystkie rezerwacje.

### Kod szkoły (opcjonalnie, zalecane)
Żeby konta mogli zakładać tylko uczniowie szkoły: kolekcja `config`, dokument `registration`,
pole `code` (string), np. `SP6-2026`. Bez tego dokumentu rejestracja jest otwarta dla wszystkich.
Kodu nie widać na stronie – sprawdzają go reguły bazy.

## 2. GitHub Pages
1. W repozytorium: **Settings → Pages**.
2. **Source:** `Deploy from a branch`, **Branch:** `main`, folder **`/docs`** → **Save**.
3. Po 1–2 minutach strona będzie pod adresem: https://techniktomek.github.io/biblioteka-sp6/

Każda zmiana wysłana na gałąź `main` automatycznie aktualizuje stronę.

## Do uzupełnienia
- `docs/index.html` → sekcja „Kontakt”: adres, telefon, e-mail biblioteki.
- Godziny otwarcia i regulamin – dopasuj do szkoły.
