# GraHeaL: modello 3D del dispositivo diagnostico Point-of-Care

Modello 3D interattivo (Three.js, un solo file `index.html`) dei due componenti fisici di **GraHeaL**:
la **cartuccia/chip biosensore monouso** su grafene e il **lettore portatile PoC**.
In [`PROMPTS.md`](PROMPTS.md) ci sono anche i prompt iper-realistici per generatori di immagini e text-to-3D.

## Come aprirlo

Il file è statico: Three.js 0.160 viene caricato da jsDelivr, quindi serve una connessione.

```bash
# da questa cartella
python3 -m http.server 8000
# poi aprire http://localhost:8000
```

Si può anche aprire `index.html` direttamente nel browser oppure pubblicarlo con GitHub Pages.
Il pulsante **Esporta .glb** scarica la geometria (lettore + cartuccia, oppure la scena nano)
per Blender, Keyshot, stampa 3D o come riferimento di forma per i generatori AI.

## Viste

| Vista | Cosa mostra |
|---|---|
| **Insieme** | Lettore palmare (~120 × 64 × 26 mm) con la cartuccia inserita nello slot, display di stato, pulsante, LED Bluetooth Low Energy, porta USB-C sul retro. |
| **Chip** | Cartuccia estratta e flessa (slider *Flessione*): substrato biopolimerico PLA o cellulosa (selettore *Substrato*), elettrodi Source/Drain/Gate in Au su strato di adesione Cr, due canali GFET in grafene (attivo funzionalizzato e riferimento passivato), coperchio microfluidico e porta di inoculo con una goccia ematica. |
| **Spaccato** | Taglio a metà della scocca (sezione in oro) con PCB, **SoC microcontrollore** con radio BLE, **modulo DSP** per filtraggio e amplificazione lock-in, AFE amperometrico/potenziometrico, connettore J1 a 6 contatti a molla allineati ai pad del chip, batteria, antenna BLE, light-pipe del LED e USB-C. |
| **Nano** | Canale attivo a scala atomica (unità: Å): reticolo esagonale di grafene monostrato, contatti Au/Cr, linker **PBASE** (pirene impilato π–π a 0,34 nm, alcuni ancora con estere NHS), **aptameri ssDNA** a forcina sotto i 2 nm (la misura reale viene calcolata dalla geometria ed è mostrata in etichetta), biomarcatori legati e liberi, barra di scala da 1 nm. |

Altri controlli:

- **Esploso**: separa gli strati del chip (substrato → grafene → Cr → Au → biostrato → fluido → coperchio) e i gusci del lettore.
- **Inocula goccia e misura**: la goccia cade nella porta, il campione riempie il canale a Y fino alle due camere e il display mostra l'acquisizione lock-in differenziale (canale attivo, riferimento e differenza).

## Struttura del chip (coordinate del modello, mm)

```
 x = 0 ──────────────────────────────────────────────── 40
 ┌──────────────────────────────────────────────────────┐
 │ G ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ▭▭▭▭ gate complanare        │  ACT (z > 0)
 │ D ▬▬▬▬▬┐               ┌─────────────┐               │
 │ S ▬▬▬┐ └───────────────│ S ▓grafene▓ D│◄──┐   ( ● )   │  porta di inoculo
 │ S ▬▬▬┘ ┌───────────────│ S ░passiv.░ D│◄──┘           │
 │ D ▬▬▬▬▬┘               └─────────────┘               │  REF (z < 0)
 │ G ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ▭▭▭▭                        │
 └──────────────────────────────────────────────────────┘
   pad di contatto → nel lettore    canali GFET    microfluidica
```

## Note

- Il lettore e il chip sono in scala reciproca. La scena nano usa una scala separata (Å).
- Le dimensioni del lettore, la capacità della batteria e le diciture sui componenti sono indicative e servono a illustrare il progetto.
- Nella vista Chip il reticolo del grafene è stilizzato perché quello reale (0,246 nm) non sarebbe visibile; nella vista Nano è in scala atomica.

## Altre app in questa repository

- [`microchef/`](microchef/): MicroChef, adatta le ricette al proprio forno a microonde partendo dal manuale (Next.js).
