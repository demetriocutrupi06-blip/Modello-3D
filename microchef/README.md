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
| 2 | Adattamento della ricetta | Fase 2 |
| 4 | Convertitore di potenza | Fase 2 |
| 5 | Scalare le porzioni | Fase 2 |
| 8 | Modalità cucina (timer, voce, schermo acceso) | Fase 3 |
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
        └── oven-profile/         schema del profilo, estrazione, caricamento, componenti, test
```

Ogni funzionalità avrà la sua cartella in `src/features/` con schema, logica, parte server, componenti e test.

## Note tecniche

- Le chiamate al modello usano lo streaming (i manuali sono lunghi), l'output strutturato con lo schema JSON
  derivato da zod e il fallback lato server attivo (`fallbacks: "default"`): se il modello rifiuta la richiesta
  per motivi di policy, l'API la passa a un altro modello. Per disattivarlo basta togliere quelle due righe da
  `src/lib/llm/client.ts`.
- Le funzioni che chiamano il modello ricevono la chiamata come parametro (`LlmCall`): nei test viene sostituita
  da una finta, quindi i test non usano la rete né la chiave.
- I calcoli numerici delle fasi successive (potenza, porzioni, diario, consumi) saranno funzioni TypeScript pure, con test.
