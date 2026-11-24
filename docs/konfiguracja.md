# Konfiguracja GitHub i Supabase (etap 0)

> **Stan od 0.7.0 (24.11.2026), zmiany względem tej instrukcji:**
> - Repozytorium jest **publiczne**, hosting **GitHub Pages**. GitHub za darmo skanuje sekrety i blokuje push z sekretem: Settings → Code security → włącz *Secret Protection* i *Push protection*.
> - Migracje wgrywasz **ręcznie w SQL Editorze** (pliki `supabase/migrations/` po kolei). Workflowy `migracje.yml` i `kopia.yml` nie są używane, w repozytorium jest tylko `ci.yml`.
> - Ustawienia Auth zmieniasz w panelu. W Authentication → URL Configuration wpisz **Site URL** = adres aplikacji na GitHub Pages (`https://<login>.github.io/<repozytorium>/`). Ten sam adres dodaj w Redirect URLs.
> - Część C (kopie) jest odłożona. Jeśli wróci, kopie w publicznym repozytorium muszą być szyfrowane.

Instrukcja krok po kroku. Zajmie około godziny. Wykonuj kroki po kolei: część B potrzebuje repozytorium z części A, a część C potrzebuje projektu z części B.

To, co da się zapisać w kodzie, jest już w repozytorium. Ręcznie zostaje tylko to, czego nie da się zrobić bez Twojego konta: zakładanie kont i projektów, sekrety, przełączniki w panelach.

## Co jest już przygotowane w repozytorium

| Plik | Do czego służy |
| --- | --- |
| `supabase/config.jsonc` | Ustawienia Auth i API jako kod: rejestracja wyłączona, hasło min. 12 znaków, TOTP włączone, Data API tylko dla schematu `public`, nowe tabele bez automatycznego dostępu |
| `supabase/migrations/0001–0003` | Tabele, CHECK, RLS, prywatny bucket na pliki, **obowiązkowe MFA w bazie** (bez kodu TOTP nie da się odczytać żadnego wiersza), automatyczny profil |
| `.github/workflows/ci.yml` | Testy, kontrola typów, walidacja konfiguracji Supabase, skan sekretów w całej historii |
| `.github/workflows/migracje.yml` | Podgląd migracji po każdej zmianie; wdrożenie tylko ręcznie, po wpisaniu `ZASTOSUJ` |
| `.github/workflows/kopia.yml` | Codzienna kopia bazy, szyfrowana Twoim kluczem, zanim opuści maszynę GitHub |
| `.github/dependabot.yml` | Cotygodniowe aktualizacje zależności i akcji |
| `.gitleaks.toml`, `scripts/git-hooks/pre-commit` | Wykrywanie sekretów (np. klucza `sb_secret_…`, adresu bazy z hasłem) |
| `scripts/ustaw-supabase.mjs` | Wpisuje adres projektu i klucz publikowalny w trzech miejscach naraz; odrzuca klucz sekretny |

## Przygotuj

- **Menedżer haseł** (np. Bitwarden, 1Password, KeePassXC). Zapiszesz w nim: hasło do bazy, token Supabase, klucz do kopii, kody odzyskiwania GitHub i Supabase.
- Na komputerze: **Node.js 22**, **git**, **age** (szyfrowanie kopii) i opcjonalnie **gitleaks** (skan przed commitem).

---

## Część A. GitHub

### G1. Zabezpiecz konto
Settings → Password and authentication: włącz uwierzytelnianie dwuskładnikowe (aplikacja TOTP albo passkey). Kody odzyskiwania zapisz w menedżerze haseł.

### G2. Utwórz repozytorium
New repository → nazwa `dziennik-zdrowia` → **Private**. Nie dodawaj README, `.gitignore` ani licencji (są w projekcie).

### G3. Wyślij kod
W katalogu projektu (rozpakowanym z paczki):

```bash
git init -b main
git config core.hooksPath scripts/git-hooks   # lokalny skan sekretów przed commitem
npm ci
npm test                                      # powinno być 0 błędów
git add .
git commit -m "Szkic 0.1 i konfiguracja etapu 0"
git remote add origin git@github.com:<twój-login>/dziennik-zdrowia.git
git push -u origin main
```

Po chwili w zakładce **Actions** workflow **CI** powinien być zielony (dwa zadania: `testy` i `sekrety`).

### G4. Bezpieczeństwo kodu
Settings → Code security: włącz **Dependency graph**, **Dependabot alerts** i **Dependabot security updates**. Wszystkie trzy są bezpłatne także w prywatnym repozytorium.

Skanowania sekretów i push protection GitHub nie udostępnia dla prywatnych repozytoriów na koncie osobistym (to płatna usługa Secret Protection dla organizacji). Zastępuje je gitleaks w CI i w lokalnym hooku z kroku G3.

### G5. Uprawnienia GitHub Actions
Settings → Actions → General:
- **Workflow permissions**: zostaw tylko odczyt zawartości repozytorium i odznacz zgodę na tworzenie i zatwierdzanie pull requestów przez Actions.
- **Actions permissions**: ogranicz dozwolone akcje do tworzonych przez GitHub i wpisanych na listę, a na listę dopisz `supabase/setup-cli@*`. Wszystkie akcje w workflowach są przypięte do konkretnych wersji (pełne SHA commita), a Dependabot będzie je aktualizował.

Sekrety i zmienne dodasz w krokach S7, K1 i K2.

### G6. Ochrona gałęzi `main` (opcjonalnie)
Reguły ochrony gałęzi w prywatnym repozytorium wymagają GitHub Pro. Przy jednej osobie piszącej kod można je pominąć. Jeśli kupisz Pro, dodaj regułę (ruleset) dla `main`: blokada force-push i usuwania, wymagane zielone CI.

---

## Część B. Supabase

### S1. Zabezpiecz konto
Ustawienia konta Supabase → Security: włącz MFA. Organizacja może zostać na planie **Free**.

### S2. Utwórz projekt
New project:
- nazwa: `dziennik-zdrowia`,
- region: **Central EU (Frankfurt)**, w CLI `eu-central-1`, czyli najbliżej Polski i w UE,
- hasło bazy: wygeneruj w kreatorze i od razu zapisz w menedżerze haseł,
- jeśli kreator pyta o automatyczne udostępnianie nowych tabel przez Data API, wyłącz to (migracja 0003 i `config.jsonc` i tak to ustawiają).

Identyfikator projektu (**ref**) to 20 liter w adresie `https://<ref>.supabase.co`.

### S3. Wgraj konfigurację i schemat z komputera
CLI jest w zależnościach projektu (`supabase` 3.4.0), więc nie trzeba go instalować osobno.

```bash
npx supabase login                          # otworzy przeglądarkę
npx supabase link --project-ref <ref>
npx supabase config diff                    # podgląd zmian w ustawieniach Auth i API
npx supabase config push                    # pokaże różnice i zapyta o zgodę
npx supabase db push --remote --dry-run     # podgląd: 3 migracje
npx supabase db push --remote
```

### S4. Sprawdź w panelu
- Authentication → ustawienia logowania: rejestracja nowych użytkowników **wyłączona**, minimalna długość hasła **12**.
- Authentication → MFA: **TOTP włączone**.
- Database → Tables: każda tabela ma RLS i dwie polityki (`wlasne_wiersze` i restrykcyjną `wymagane_mfa`).
- Advisors → Security Advisor: brak błędów.

### S5. Podłącz aplikację
Project Settings → API Keys → skopiuj **klucz publikowalny** (`sb_publishable_…`). Potem:

```bash
npm run ustaw-supabase -- --url https://<ref>.supabase.co --klucz sb_publishable_...
npm run precache
git add . && git commit -m "Adres projektu Supabase" && git push
```

Klucz publikowalny jest jawny z założenia: dane chroni RLS i obowiązkowe MFA. **Klucza sekretnego (`sb_secret_…`) aplikacja nie potrzebuje**: nie twórz go, a jeśli istnieje, nie kopiuj go nigdzie. Skrypt odmówi jego wpisania. Jeśli projekt pokazuje jeszcze stare klucze `anon` i `service_role`, wyłącz je, gdy aplikacja będzie działać na nowych (Supabase wycofuje je do końca 2026 r.).

### S6. Załóż konta
Authentication → Users → **Add user → Create new user**: e-mail, silne hasło (min. 12 znaków), zaznacz **Auto Confirm**. Powtórz dla 1–2 bliskich osób.

- **Nie wysyłaj zaproszeń e-mailem.** Wbudowana poczta Supabase dostarcza wiadomości tylko członkom zespołu organizacji, z limitem 2 na godzinę. Własny serwer SMTP podłączymy razem z przypomnieniami (etap 5).
- **Nie dodawaj bliskich do zespołu organizacji w Supabase.** Członek zespołu ma dostęp do panelu, a w nim do danych wszystkich użytkowników.
- Hasło przekaż osobiście. Każda osoba włączy TOTP przy pierwszym logowaniu (ekran logowania to następny krok). Bez TOTP baza nie zwróci żadnych danych.
- Jeśli ktoś zgubi telefon z aplikacją TOTP: Authentication → Users → użytkownik → usuń jego czynnik MFA, a przy następnym logowaniu doda nowy. Supabase nie ma kodów zapasowych, ale można dodać drugi czynnik TOTP na innym urządzeniu.

### S7. Sekrety dla wdrażania migracji
- Supabase → Account → Access Tokens → nowy token. Jeśli formularz pozwala ograniczyć token do jednego projektu, ogranicz go do `dziennik-zdrowia`.
- GitHub → Settings → Secrets and variables → Actions:
  - **Secrets**: `SUPABASE_ACCESS_TOKEN` (token), `SUPABASE_DB_PASSWORD` (hasło z S2),
  - **Variables**: `SUPABASE_PROJECT_ID` (ref).
- Test: Actions → **Migracje bazy** → Run workflow (zostaw `podgląd`). Powinno pokazać, że baza jest aktualna.

Kolejne migracje: dodajesz plik `supabase/migrations/0004_…sql`, push na `main` uruchomi podgląd, a wdrożenie uruchamiasz ręcznie z wpisanym `ZASTOSUJ`.

---

## Część C. Kopie zapasowe

Plan Free nie ma automatycznych kopii. Workflow `kopia.yml` robi codzienny zrzut, szyfruje go Twoim kluczem publicznym i przechowuje 30 dni jako artefakt w GitHub.

### K1. Klucz do kopii
```bash
age-keygen -o ~/dziennik-kopie.key
```
Polecenie wypisze klucz publiczny `age1…`. Dodaj go w GitHub jako **Variable** `AGE_RECIPIENT`. Plik `~/dziennik-kopie.key` (klucz prywatny) zapisz w menedżerze haseł i na nośniku offline. **Bez niego kopii nie odszyfrujesz.** Nigdy nie wgrywaj go do GitHub.

### K2. Połączenie z bazą
Supabase → **Connect** → **Session pooler** → URI. Wstaw hasło z S2 w miejsce `[YOUR-PASSWORD]` i dodaj całość jako **Secret** `SUPABASE_DB_URL`. Pooler jest konieczny, bo połączenie bezpośrednie działa tylko przez IPv6, a maszyny GitHub Actions łączą się przez IPv4.

### K3. Pierwsza kopia i odszyfrowanie
Actions → **Kopia zapasowa bazy** → Run workflow. Pobierz artefakt i sprawdź:

```bash
age -d -i ~/dziennik-kopie.key kopia-RRRR-MM-DD.tar.gz.age | tar -tzf -
# powinny być: ./role.sql ./schemat.sql ./dane.sql
```

Artefakty znikają po 30 dniach. Raz w miesiącu pobierz najnowszą kopię i przechowuj ją offline. Plik jest zaszyfrowany, więc może leżeć np. na dysku w chmurze.

### K4. Próba odtworzenia (raz, przed prawdziwymi danymi)
Specyfikacja (sekcja 13) wymaga sprawdzenia, że kopię da się odtworzyć. Najprościej na drugim, pustym projekcie Free:

```bash
mkdir odtworzenie
age -d -i ~/dziennik-kopie.key kopia-RRRR-MM-DD.tar.gz.age | tar -xzf - -C odtworzenie
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file odtworzenie/role.sql --file odtworzenie/schemat.sql \
  --command 'SET session_replication_role = replica' \
  --file odtworzenie/dane.sql \
  --dbname "<session pooler projektu testowego>"
```

Po teście usuń projekt testowy.

---

## Lista kontrolna

- [ ] GitHub: 2FA, repozytorium prywatne, CI zielone (testy i sekrety)
- [ ] GitHub: Dependabot (3 przełączniki), uprawnienia Actions ograniczone
- [ ] Supabase: MFA na koncie, projekt we Frankfurcie, `config push` i 3 migracje wgrane
- [ ] Supabase: rejestracja wyłączona, TOTP włączone, Security Advisor bez błędów
- [ ] Aplikacja: adres i klucz publikowalny ustawione skryptem, klucz sekretny nigdzie nie zapisany
- [ ] Konta utworzone ręcznie, bez zaproszeń e-mail i bez dodawania do zespołu
- [ ] Sekrety: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`; zmienne: `SUPABASE_PROJECT_ID`, `AGE_RECIPIENT`
- [ ] Kopia: pierwszy artefakt odszyfrowany, próba odtworzenia wykonana
- [ ] W menedżerze haseł: hasło bazy, token, klucz age, kody odzyskiwania

## Różnice wobec specyfikacji v0.1

| Specyfikacja | Rzeczywistość (listopad 2026) | Rozwiązanie |
| --- | --- | --- |
| Secret scanning w repozytorium (sekcja 8) | Niedostępne dla prywatnych repozytoriów na koncie osobistym | gitleaks w CI i w hooku przed commitem |
| Obowiązkowe MFA (sekcja 8) | Supabase domyślnie wpuszcza też sesje bez drugiego składnika | Restrykcyjne polityki `aal2` na wszystkich tabelach i w Storage |
| Wylogowanie po nieaktywności (sekcja 8) | Limity czasu sesji w Supabase są tylko w planie Pro | Wylogowanie w aplikacji (następny krok) |
| Kopia bazy (sekcja 13) | Plan Free bez automatycznych kopii | Codzienny workflow z szyfrowaniem |
| Klucz `anon` (sekcja 8) | Zastępowany kluczem publikowalnym `sb_publishable_…` | Aplikacja używa klucza publikowalnego |
| Zatwierdzanie wdrożeń | Wymagani recenzenci środowisk niedostępni w prywatnych repozytoriach | Wdrożenie migracji tylko ręcznie, słowem `ZASTOSUJ` |

**Wstrzymywanie projektu:** Supabase wstrzymuje projekty Free po tygodniu niskiej aktywności i wysyła e-mail z wyprzedzeniem. Codzienna kopia łączy się z bazą, ale Supabase nie podaje dokładnej definicji aktywności, więc nie jest to gwarancja. Wstrzymany projekt przywracasz w panelu. Plan Pro (25 USD/mies.) usuwa wstrzymywanie i dodaje codzienne kopie z 7 dni.

## Następne kroki

1. Ekran logowania z TOTP (zapis czynnika, weryfikacja, wylogowanie po nieaktywności), biblioteka `supabase-js` lokalnie w `js/vendor/` z sumą kontrolną.
2. Synchronizacja kolejki `outbox` z bazą.
3. Wybór hostingu (Cloudflare Pages lub Netlify), potem `site_url` w `supabase/config.jsonc` i `npx supabase config push`.
