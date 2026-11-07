# MicroChef

Applicazione web che adatta qualsiasi ricetta al **tuo** forno a microonde, partendo dal suo manuale d'uso.
Next.js + TypeScript + Tailwind, SQLite con Prisma, API di Anthropic per leggere il manuale e le ricette.

## Setup in locale

Serve Node.js 20 o superiore.

```bash
cd microchef
npm install
cp .env.example .env      # la chiave ANTHROPIC_API_KEY è facoltativa: senza, l'app usa la modalità gratuita
npx prisma db push        # crea il database SQLite (prisma/dev.db)
npm run dev               # http://localhost:3000
```

Variabili in `.env`:

| Variabile | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | facoltativa. Chiave API, letta solo dal server (mai inviata al browser): abilita la lettura del manuale con Claude, a pagamento |
| `ANTHROPIC_MODEL` | modello da usare, predefinito `claude-sonnet-5-5` (per più qualità: `claude-opus-5-5`) |
| `ANTHROPIC_EFFORT` | `low`, `medium` o `high`: quanto il modello ragiona prima di rispondere |
| `DATABASE_URL` | percorso del database SQLite |

Comandi utili: `npm test` (test unitari), `npm run lint` (controllo dei tipi), `npm run build`, `npm run db:studio` (sfoglia il database).

Per installarla come app sul telefono serve la build di produzione (`npm run build && npm start`) servita in HTTPS,
ad esempio pubblicandola su Vercel. In locale, sul computer, il browser la considera già sicura.

## Funzionalità

| # | Funzionalità | Stato |
|---|---|---|
| 1 | Caricamento del manuale e profilo forno | ✅ Fase 1 |
| 2 | Adattamento della ricetta (gratis con regole, oppure con Claude) | ✅ Fase 2 |
| 4 | Convertitore di potenza | ✅ Fase 2 |
| 5 | Scalare le porzioni | ✅ Fase 2 |
| 8 | Modalità cucina (timer, voce, schermo acceso) | ✅ Fase 3 |
| 3, 6, 7 | Suggerimenti, avanzi, controllo contenitori | Fase 4 |
| 9, 11 | Diario di cottura, assistente del manuale | Fase 5 |
| 10, 12 | Meal prep e lista della spesa, stima dei consumi | Fase 6 |

### Fase 1: manuale e profilo forno

1. **Caricamento** (`/forni/nuovo`): un PDF oppure le foto delle pagine (lette in ordine di nome file).
2. **Estrazione del testo**
   - PDF con testo: `pdf-parse`, con una ricomposizione delle colonne (`src/lib/ingest/layout.ts`). Molti manuali sono
     su due colonne e la lettura riga per riga le mescolerebbe; le etichette laterali ruotate vengono scartate.
   - PDF scansionato (quasi senza testo): il PDF viene passato all'API di Claude, che lo trascrive pagina per pagina.
   - Foto: OCR in italiano con `tesseract.js`.
3. **Sezioni**: il testo viene diviso in sezioni in base ai titoli in maiuscolo (`src/lib/ingest/sections.ts`).
   Ogni sezione ha un id citabile con la pagina, es. `p14-livelli-di-potenza-e-modifiche-dei-tempi`.
4. **Profilo forno, modalità gratuita** (predefinita senza chiave API): nessuna chiamata a Claude. Il profilo viene
   pre-compilato con regole sul testo (`src/features/oven-profile/heuristics.ts`): tabella dei livelli di potenza,
   capacità in litri, potenza resa e assorbita, codici di errore, modalità trovate nei titoli, marca e modello.
   Il resto (programmi automatici, accessori, contenitori, avvertenze) lo completi tu, con il testo del manuale
   consultabile nella stessa pagina. I PDF scansionati vanno caricati come foto delle pagine, lette con l'OCR.
5. **Profilo forno, con Claude** (a pagamento, richiede la chiave): il modello riceve tutte le sezioni e restituisce un JSON (`src/features/oven-profile/schema.ts`)
   con marca, modello, capacità, livelli di potenza (W resi), potenza assorbita, modalità, programmi automatici,
   accessori, regole sui contenitori, avvertenze, risoluzione dei problemi e codici di errore.
   - La risposta è validata con zod; se non è valida, il modello riprova **una** volta ricevendo gli errori.
   - Ogni dato cita la sezione di provenienza; una citazione a una sezione inesistente conta come errore.
   - I dati mancanti restano vuoti e vengono annotati in «Note dell'estrazione», invece di essere inventati.
6. **Verifica**: il forno viene salvato come «da verificare». Nella sua pagina puoi correggere ogni campo
   (oppure il JSON completo), aprire la sezione del manuale citata e infine premere **Conferma e salva**.
7. **Più forni**: puoi salvarne quanti vuoi («Casa», «Casa dei genitori») e scegliere quello attivo.

### Come provare la Fase 1

1. Avvia l'app con i comandi del setup e apri http://localhost:3000.
2. Premi «Carica il manuale del tuo forno», scegli il PDF, dai un nome al forno, scegli «Gratis» oppure
   «Con Claude» e premi «Leggi il manuale». In modalità gratuita servono pochi secondi; con Claude da uno a tre minuti.
3. Controlla il profilo: livelli di potenza, modalità (es. Cb-1 e Cb-2), accessori (la vaporiera solo a microonde),
   codici di errore. Tocca una citazione 📖 per aprire il testo del manuale da cui proviene il dato.
4. Correggi quello che serve e premi «Conferma e salva». Il forno compare in «I miei forni» e, se è il primo, diventa attivo.

Test automatici: `npm test`. Per provare l'estrazione anche sul PDF reale (che non è nella repository perché
protetto da copyright):

```bash
MANUAL_PDF=/percorso/del/manuale.pdf npm test
```

### Fase 2: ricette, convertitore di potenza, porzioni

**Convertitore di potenza** (`/strumenti/potenza`, codice in `src/features/power-converter/logic.ts`)
- Formula a energia costante: `t₂ = t₁ × P₁ / P₂`. Il livello scelto è quello del forno più vicino alla potenza
  originale (a parità, il più alto), oppure quello indicato dall'utente.
- Arrotondamento: sotto il minuto a 5 s, fino a 5 minuti a 10 s, oltre a 30 s.
- Legge anche un testo libero come un'etichetta: "Riscaldare 3 min a 750 W", "2'30\"", "3-4 minuti a 650 W".
- Mostra sempre l'avviso di controllare la cottura, più avvisi per potenze molto diverse dall'originale.

**Porzioni** (`src/features/portions/logic.ts`)
- Ingredienti proporzionali, con arrotondamenti da cucina (grammi a 5 o 10, pezzi a ½, cucchiai a ¼) e
  riconoscimento di formati come "200 g di farina", "Farina 00 200 g", "1/2 cucchiaino", "2-3 patate".
- Tempi **non lineari**: `t₂ = t₁ × r^0,65` (r = porzioni nuove / originali). Dose doppia → × 1,57, metà → × 0,64.
  Si applica ai passaggi al microonde; in convezione e grill il tempo dipende soprattutto dallo spessore e resta uguale.
  Sopra ×4 o sotto ×0,25 compare un avviso, e sempre il promemoria di controllare a metà cottura.

**Adattamento della ricetta** (`/ricette/nuova`)
- Input: testo incollato, link a una pagina (dati strutturati schema.org, oppure il testo dell'articolo) o foto (OCR).
  Il testo estratto si può correggere prima di adattarlo.
- **Gratis** (`src/features/recipe-adapt/free-adapter.ts`): riconosce il tipo di cottura di ogni passaggio
  (`detect.ts`) e lo traduce nelle modalità che il forno ha davvero:

  | Ricetta | Sul tuo forno |
  |---|---|
  | Forno tradizionale | Convezione, stessa temperatura e stesso tempo, preriscaldato (alternativa: combinato con tempo × 0,6) |
  | Gratinare | Grill, stesso tempo (5 min se non indicato) |
  | Padella, rosolare | Crisp se presente, altrimenti microonde + grill, altrimenti microonde (senza doratura) |
  | Stufare, sobbollire | Microonde a ⅔ della potenza, tempo × 0,7, coperto, liquidi −20% |
  | Lessare pasta o riso | Microonde alla massima potenza, tempo × 1,25, acqua abbondante |
  | Lessare verdure | Microonde alla massima potenza, tempo × 0,5, poca acqua, coperto |
  | Vapore | Recipiente vapore se presente, massima potenza, tempo × 0,8 |
  | Già per microonde (es. 750 W) | Convertitore di potenza |
  | Sciogliere burro o cioccolato | Metà potenza, a intervalli di 30 s |
  | Friggere | Non coperto: lo dichiara (e propone il crisp, se c'è) |

  Ogni passaggio indica se l'impostazione viene **dal manuale** (con la sezione citata), da una **regola generale**,
  oppure se **non è coperta**. La fattibilità (si può fare / in parte / sconsigliato) deriva da questo.
- **Con Claude** (`ai-adapter.ts`, solo con la chiave API): riceve il profilo, le sezioni del manuale più pertinenti
  (ricerca BM25 in `src/lib/retrieval/bm25.ts`) e la ricetta; la risposta è validata con zod (modalità esistenti,
  citazioni reali) e poi il codice riporta potenze e tempi ai livelli reali del forno.
- Nella pagina della ricetta si cambiano le porzioni con − e +; le citazioni 📖 aprono la sezione del manuale.

### Come provare la Fase 2

1. **Convertitore**: menu *Potenza*, scrivi "Riscaldare 3 min a 750 W" e controlla il risultato
   (sul Samsung: 2 min 30 s a ALTO, 900 W). Prova anche a scegliere un livello diverso.
2. **Ricetta**: menu *Ricette* → *+ Adatta*, incolla una ricetta con ingredienti e procedimento, lascia *Gratis* e
   premi *Adatta al mio forno*. Controlla per ogni passaggio modalità, potenza, tempo e citazioni.
3. **Porzioni**: nella ricetta premi + e −: cambiano le quantità e i tempi dei passaggi al microonde.
4. **Link e foto**: prova con l'indirizzo di una ricetta online, oppure con la foto di una ricetta o di un'etichetta.

### Fase 3: modalità cucina

Dalla pagina di una ricetta: **👩‍🍳 Inizia a cucinare** (porta con sé il numero di porzioni scelto).

- **Una schermata per passaggio**, testi grandi e pulsanti ampi (Indietro / Avanti); la prima schermata
  elenca gli ingredienti, l'ultima chiude la ricetta.
- **Timer per ogni passaggio** con tempo (già adattato alle porzioni): Avvia/Pausa, +30 s, Azzera.
  Si basa su orari assoluti (`src/features/cooking-mode/timer.ts`), quindi resta preciso anche con lo schermo
  in background. Se cambi passaggio mentre un timer corre, compare una barra con il conto alla rovescia.
- **A fine tempo**: avviso sonoro (Web Audio), vibrazione sul telefono e notifica (se la autorizzi).
- **Schermo sempre acceso** con la Wake Lock API (indicatore ☀️ in alto a destra).
- **Lettura ad alta voce** delle istruzioni in italiano (🔊 Leggi, oppure "Leggi sempre" a ogni passaggio).
- **Comandi vocali** in italiano (Web Speech API, `speech.ts`): "prossimo passaggio", "indietro", "ripeti",
  "quanto manca?", "avvia timer", "pausa timer", "ingredienti". Funzionano su **Chrome ed Edge**; su Opera e
  Firefox il riconoscimento vocale non è disponibile (la lettura ad alta voce sì). Chrome invia l'audio ai server
  di Google per il riconoscimento, quindi serve la connessione.

Limiti dei browser: microfono, notifiche e schermo acceso richiedono un indirizzo sicuro (`https://` oppure
`http://localhost`). Aprendo l'app dal telefono con l'indirizzo IP del computer queste funzioni non sono disponibili.

### Come provare la Fase 3

1. Apri una ricetta adattata, scegli le porzioni e premi **👩‍🍳 Inizia a cucinare**.
2. Premi **Inizia ▶**, poi **▶ Avvia** sul timer; prova **+30 s**, **Pausa** e cambia passaggio: in alto resta il conto alla rovescia.
3. Lascia finire un timer breve (puoi ridurlo con Azzera e una ricetta da 1 minuto) per sentire l'avviso.
4. In Chrome o Edge premi **🎙️ Comandi vocali**, consenti il microfono e di' "avvia timer", "quanto manca?", "prossimo passaggio".

## Struttura

```
microchef/
├── prisma/schema.prisma          schema completo (anche le tabelle delle fasi successive)
├── public/                       manifest PWA, icone, service worker
└── src/
    ├── app/                      pagine e API routes (sottili: delegano a features/)
    │   ├── api/ovens/…           POST carica manuale · GET/PUT/DELETE forno · POST attiva
    │   └── forni/…               elenco, caricamento, verifica del profilo
    ├── lib/
    │   ├── ingest/               PDF (con colonne), OCR, trascrizione PDF scansionati, sezioni
    │   ├── llm/                  client Anthropic, output JSON validato con zod e riprova
    │   └── db.ts                 client Prisma
    └── features/
        ├── oven-profile/         schema del profilo, estrazione (Claude o regole), caricamento, componenti
        ├── power-converter/      convertitore di potenza (funzioni pure + pagina)
        ├── portions/             porzioni: ingredienti e tempi (funzioni pure)
        ├── recipe-adapt/         lettura ricette, riconoscimento cotture, adattamento gratis e con Claude
        └── cooking-mode/         modalità cucina: timer, comandi vocali, sintesi vocale, schermo acceso
```

Ogni funzionalità avrà la sua cartella in `src/features/` con schema, logica, parte server, componenti e test.

## Note tecniche

- Le chiamate al modello usano lo streaming (i manuali sono lunghi), l'output strutturato con lo schema JSON
  derivato da zod e il fallback lato server attivo (`fallbacks: "default"`): se il modello rifiuta la richiesta
  per motivi di policy, l'API la passa a un altro modello. Per disattivarlo basta togliere quelle due righe da
  `src/lib/llm/client.ts`.
- Le funzioni che chiamano il modello ricevono la chiamata come parametro (`LlmCall`): nei test viene sostituita
  da una finta, quindi i test non usano la rete né la chiave.
- Tutti i calcoli numerici (potenza, porzioni, arrotondamenti) sono funzioni TypeScript pure, con test; anche
  nella versione con Claude i numeri finali li calcola il codice.
