# P10 — Simulatore Gara Pistola 10m

## Introduzione

P10 è una **PWA** (Progressive Web App) per simulare gare di tiro a segno con pistola ad aria compressa a 10 metri, secondo il formato **ISSF**: una fase di prova a tempo seguita da una gara di 60 colpi suddivisa in 6 serie da 10. È pensata come strumento di allenamento per riprodurre, anche da soli, la pressione e la gestione del tempo tipiche di una gara reale — con cronometro, conferma dei colpi, registrazione dei punteggi e archivio delle sessioni svolte.

L'app è completamente **self-contained**: nessun framework, nessun bundler, nessuna dipendenza da installare. È pensata per essere installata sul telefono come app (icona in home screen, funzionamento offline per le parti statiche) ma funziona perfettamente anche da browser desktop.

## Funzionalità

- **Configurazione gara**: scelta del tipo di bersaglio (cartaceo / elettronico — cambia la durata della fase di gara), modalità di conferma del colpo (manuale o automatica con countdown), opzione "mostra somme parziali", e modalità di punteggio (vedi sotto).
- **Fase di prova**: 15 minuti a disposizione per sparare colpi di prova prima dell'inizio della gara vera e propria.
- **Fase di gara**: 60 colpi in 6 serie da 10, con timer dedicato (90 minuti per bersaglio cartaceo, 75 per elettronico) e gestione di pausa/ripresa.
- **Due modalità di registrazione del colpo**:
  - **A punto**: inserimento diretto del valore (0–10 e Mouche) tramite una griglia di pulsanti.
  - **A rosata**: si trascina un pallino (in scala, ⌀ 4,5 mm) direttamente sul disegno del bersaglio; il punteggio viene calcolato geometricamente dalla posizione di rilascio, con una lente d'ingrandimento che segue il dito mostrando il punteggio in tempo reale. Include selettore destro/mancino per posizionare la lente dal lato comodo, preset di zoom (1x/2x) e visualizzazione in trasparenza dei colpi già sparati nella serie corrente.
- **Conferma del colpo**: overlay di conferma manuale o automatico (con countdown configurabile), per riprodurre la "lettura" del colpo come in una gara reale.
- **Interruzione gara**: possibilità di abortire una gara in corso; i colpi mancanti vengono registrati automaticamente come 0.
- **Report di fine gara**: punteggio totale, dettaglio per serie (punti, mouche, tempi), distribuzione dei valori, **rosate** (mappa dei colpi sul bersaglio per serie e totale gara, con zoom a schermo intero al tap), grafici dell'andamento del tempo impiegato per ogni colpo (per serie e sull'intera gara), ed esportazione del report come immagine PNG.
- **Archivio sessioni**: storico delle gare svolte, consultabile e riapribile in qualsiasi momento per rivedere il report completo.
- **Autenticazione**: accesso tramite utente/password (sessioni PHP), pannello di amministrazione per la gestione utenti.
- **Tema chiaro/scuro** e installazione come app (PWA con service worker e manifest).

## Installazione

L'app non richiede build né package manager: è sufficiente servire i file con PHP-FPM.

**Requisiti**:
- PHP 8.2+ con estensione PDO/SQLite3
- Un web server che inoltri le richieste a PHP-FPM (es. Caddy, nginx)

**Passi**:
1. Posizionare i file del progetto nella document root del web server.
2. Assicurarsi che la directory `data/` sia scrivibile dal processo PHP — il database SQLite (`data/p10.db`) viene creato automaticamente al primo avvio, completo di schema e utente amministratore di default.
3. Configurare il web server affinché instradi le richieste `.php` a `php8.2-fpm.sock` (o equivalente) e serva direttamente i file statici (`assets/`, `manifest.json`, `sw.js`, ecc.).
4. Aprire l'app dal browser: al primo accesso si può effettuare il login con le credenziali seedate di default (**admin / admin**) — si consiglia di cambiarle subito dal pannello utente.

Non sono necessarie variabili d'ambiente: i parametri principali (versione applicazione, percorso del database, nome della sessione) sono definiti in `config.php`.

## Dettagli tecnici

**Stack**: PHP 8.2 (PDO/SQLite3) lato backend, JavaScript vanilla (moduli ES) lato frontend, nessun framework né bundler. Database SQLite a singolo file in `data/p10.db`.

**Architettura backend** (`src/`, `api/`, `index.php`):
- `index.php` è l'unico punto di ingresso: renderizza una shell HTML, mentre tutta la navigazione successiva avviene via JavaScript (SPA basata su `location.hash`).
- `src/Database.php` gestisce la connessione PDO (singleton) e crea automaticamente lo schema (tabelle `users`, `training_sessions`, `shots`) al primo utilizzo, seminando l'utente amministratore predefinito.
- `src/Auth.php` gestisce l'autenticazione basata su sessione PHP, con password hashate.
- `src/SessionModel.php` / `src/UserModel.php` sono layer di accesso ai dati sottili sopra PDO (un metodo per operazione, nessun ORM).
- `api/*.php`: un file per endpoint, ciascuno segue lo stesso schema (verifica del metodo HTTP, autenticazione, parsing del corpo JSON, risposta tramite helper condivisi) — copre login/logout, creazione/aggiornamento/interruzione/eliminazione sessioni, registrazione colpi, archivio, gestione utenti.

**Architettura frontend** (`assets/js/`): moduli ES vanilla, nessun virtual DOM — le pagine sono renderizzate impostando l'`innerHTML` del contenitore principale con template string.
- `app.js`: bootstrap dell'app, router basato su hash, rendering di tutte le pagine (home, configurazione, allenamento, archivio, amministrazione, impostazioni, login, report) e gestione del tema.
- `competition.js`: macchina a stati della sessione di allenamento/gara — gestisce le fasi (prova → gara → completata/interrotta), la registrazione dei colpi, gli overlay di conferma/pausa e la sincronizzazione con il backend; persiste lo stato in `localStorage` così una sessione in corso sopravvive al ricaricamento della pagina.
- `target.js`: geometria e disegno SVG del bersaglio (anelli, calcolo del punteggio dalla posizione, marcatori dei colpi) — fonte di verità unica condivisa tra il widget di input "a rosata" e il report.
- `timer.js`: cronometro con gestione di pausa/ripresa basato su delta temporali (non su `setInterval`, per evitare derive).
- `report.js`: calcolo e aggregazione dei punteggi, rendering del report (incluse rosate e grafici dei tempi) ed esportazione in PNG.

**PWA** (`sw.js`, `manifest.json`): il service worker mette in cache solo gli asset statici (CSS, JS, icone); le pagine PHP e le chiamate API restano sempre network-only, dato che dipendono dalla sessione utente e non devono mai essere servite da cache.

**Regole di gara implementate**: fase di prova di 15 minuti, gara di 60 colpi in 6 serie da 10, durata gara di 90 minuti (bersaglio cartaceo) o 75 minuti (bersaglio elettronico) — costanti definite in `competition.js` e facilmente regolabili.
