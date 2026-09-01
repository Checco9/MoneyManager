# Money Manager — versione Cloud (GitHub + Supabase)

Questa è la versione "vera app web" di Money Manager: nessun server da tenere
acceso, dati salvati su Supabase (Postgres in cloud), accessibile da PC e da
telefono ovunque tu sia, protetta da login.

## Come funziona ora

- **Prima**: Node/Express sul tuo PC + file JSON locale → accessibile solo
  da casa, solo col PC acceso.
- **Ora**: solo file statici (HTML/CSS/JS) pubblicati su GitHub Pages, che
  parlano direttamente con **Supabase** (database + login). Il PC non deve
  restare acceso: l'app vive online 24/7 sui server di Supabase/GitHub.

---

## Passo 1 — Crea le tabelle su Supabase

1. Vai sul tuo progetto Supabase → sezione **SQL Editor** → **New query**
2. Apri il file `sql/schema.sql` di questo progetto, copia **tutto** il
   contenuto, incollalo nell'editor e premi **Run**
3. Dovresti vedere confermata la creazione di 9 tabelle e delle categorie
   di default già inserite

## Passo 2 — Crea i due utenti (tu e la tua ragazza)

Non c'è una pagina di registrazione pubblica (di proposito, per sicurezza).
Gli account si creano a mano:

1. Dashboard Supabase → **Authentication** → **Users** → **Add user**
2. Inserisci email e password per te, poi ripeti per la tua ragazza
3. Spunta **"Auto Confirm User"** se presente, così non serve verificare
   l'email per poter accedere subito

## Passo 3 — Collega il frontend al tuo progetto Supabase

1. Dashboard Supabase → **Project Settings** → **API**
2. Copia **Project URL** e la chiave **anon public**
3. Apri `js/supabase-config.js` in questo progetto e incolla i due valori
   al posto di `INCOLLA_QUI_...`

## Passo 4 — Pubblica su GitHub

```bash
cd money-manager-web
git init
git add .
git commit -m "Prima versione cloud di Money Manager"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/money-manager.git
git push -u origin main
```

(Sostituisci `TUO-USERNAME` con il tuo nome utente GitHub — crea prima un
repository vuoto su github.com se non l'hai già fatto, senza README/licenza
per evitare conflitti col primo push.)

## Passo 5 — Attiva GitHub Pages

1. Sul repository GitHub → **Settings** → **Pages**
2. In "Source" scegli **Deploy from a branch**, branch **main**, cartella
   **/ (root)**
3. Salva. Dopo 1-2 minuti la tua app sarà online su:
   `https://TUO-USERNAME.github.io/money-manager/`

Da quel momento, ogni volta che modifichi i file e fai `git push`, il sito
si aggiorna automaticamente in 1-2 minuti.

## Passo 6 — Accedi anche da telefono

Apri lo stesso indirizzo `https://TUO-USERNAME.github.io/money-manager/`
dal browser del telefono (Wi-Fi o dati mobili, non serve la stessa rete di
casa: è un sito vero su internet). Fai login con le credenziali create al
Passo 2. Per un accesso più rapido, usa "Aggiungi a schermata Home" dal
menu del browser per avere un'icona come un'app vera.

---

## Note importanti

- **La chiave "anon" in `supabase-config.js` non è un segreto**: è pensata
  per stare nel codice pubblico. La vera protezione dei dati è la Row Level
  Security (RLS) attivata dallo script SQL: solo chi ha fatto login può
  leggere o scrivere qualcosa.
- **I dati sono condivisi** tra tutti gli account autenticati (tu e la tua
  ragazza vedete e modificate le stesse finanze) — è il modello scelto per
  una gestione di coppia.
- **Backup**: dalla sezione Impostazioni dell'app puoi sempre esportare
  tutto in JSON o le sole transazioni in CSV. Fallo periodicamente.
- Il vecchio server Express (`server.js`, cartella `routes/`, ecc.) **non
  serve più** in questa versione: è rimasto solo nel progetto originale
  per uso locale, se mai volessi tornare a quello.
