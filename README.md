# Biblioteka SP nr 6 im. Michała Elwiro Andriollego

Strona biblioteki szkolnej – w pełni statyczna (folder `docs/`), gotowa do GitHub Pages i Netlify.
Nie wymaga serwera ani bazy danych.

**Adres strony:** https://techniktomek.github.io/biblioteka-sp6/

## Co jest na stronie
- **Start** – animowany nagłówek, liczniki, oferta, *książka tygodnia* (zmienia się co tydzień), nowości,
  kalendarz wydarzeń, godziny otwarcia z informacją „teraz otwarte / zamknięte”, patron, regulamin, FAQ, kontakt.
- **Katalog** – wyszukiwarka (skrót `/`), kategorie, sortowanie, „tylko dostępne”, ulubione, losowanie książki,
  okno ze szczegółami i opisem każdej książki.
- **Logowanie / rejestracja** – z gotowymi kontami testowymi.
- **Moje konto** – rezerwacje z terminem odbioru, ulubione, limit rezerwacji; dla bibliotekarza panel
  wszystkich rezerwacji z wyszukiwarką, sortowaniem i statystykami.
- Tryb jasny/ciemny, animacje przy przewijaniu, pasek postępu, przycisk „do góry”, wersja na telefon.
  Animacje wyłączają się automatycznie, gdy ktoś ma włączone „ogranicz ruch” w systemie.

## Konta testowe
| Rola | E-mail | Hasło |
|---|---|---|
| Uczeń | `uczen@sp6.pl` | `uczen123` |
| Bibliotekarz | `bibliotekarz@sp6.pl` | `biblio123` |

Na stronie logowania wystarczy kliknąć kafelek konta testowego.

> **Uwaga:** to wersja demonstracyjna. Konta i rezerwacje zapisują się tylko w przeglądarce
> (localStorage) – każdy odwiedzający widzi własne dane, a bibliotekarz nie widzi rezerwacji
> zrobionych na innych komputerach. W „Moje konto” jest przycisk „Przywróć dane testowe”.

## Publikacja na GitHub Pages
1. W repozytorium: **Settings → Pages**.
2. **Source:** `Deploy from a branch`, **Branch:** `main`, folder **`/docs`** → **Save**.
3. Po 1–2 minutach strona działa pod adresem podanym wyżej. Każdy push na `main` ją aktualizuje.

## Edycja treści
- Książki: `docs/js/books.js`
- Godziny otwarcia i wydarzenia: tablice `HOURS` i `EVENTS` na dole `docs/index.html`
- Kontakt: `docs/index.html` (sekcja „Kontakt”) i stopka w każdej stronie – wpisz adres, telefon i e-mail.
