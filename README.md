# Panini IPTC Metadata Tool — versione 100% locale (browser)

Tutto gira nel browser: OCR (tesseract.js), lettura Excel (SheetJS) e scrittura
IPTC/XMP (exiv2-wasm, la vera libreria Exiv2 in WebAssembly) sono eseguiti
localmente. **Nessuna immagine lascia il computer.** Dopo il caricamento
iniziale della pagina, l'app non fa più nessuna chiamata di rete: va bene
anche dietro firewall aziendali restrittivi.

Richiede **Chrome o Edge su desktop** (macOS/Windows/Linux) per la modifica
diretta dei file nella cartella scelta (File System Access API). Non
funziona su Firefox/Safari per questa parte.

## ⚠️ Prima di usarlo su un batch vero

Questa è una versione appena costruita: ho validato a fondo la parte più
rischiosa (scrittura metadati IPTC/XMP con caratteri accentati, apostrofi,
simbolo °, confronto fuzzy dei nomi — risultati identici a ExifTool e a
Python), ma **non ho potuto testare l'interfaccia in un vero Chrome** (il
sandbox in cui l'ho costruita non ha un browser reale disponibile). Prima di
usarla su una collezione vera:

1. Provala su una decina di immagini di scarto.
2. Confronta l'output con `exiftool -IPTC:all -XMP:all nomefile.jpg`.
3. Solo dopo, usala su un batch reale (con backup dei file originali, come
   sempre buona norma).

Se trovi un problema, mandami l'errore (di solito visibile nella console del
browser, tasto destro > Ispeziona > Console) e lo sistemiamo.

## Come distribuirlo in ufficio (senza installare nulla)

**Opzione consigliata — hosting statico gratuito (GitHub Pages):**

1. Crea un repository GitHub (anche privato) e carica tutto il contenuto di
   questa cartella.
2. Impostazioni del repo → Pages → Deploy da branch `main`, cartella `/`.
3. Dopo un minuto avrai un link tipo `https://tuoutente.github.io/panini-web/`.
4. In ufficio, apri quel link in Chrome: è una pagina web normale, il
   firewall aziendale la tratta come qualsiasi sito.

Va bene anche Netlify o Vercel (drag-and-drop della cartella, ancora più
veloce da attivare).

**Alternativa — server locale sul tuo Mac, se non vuoi pubblicare nulla online:**

```bash
cd panini-client
python3 -m http.server 8090
```
poi apri `http://localhost:8090` in Chrome. Funziona perché `localhost` è
considerato "origine sicura" dal browser (a differenza di aprire il file
`.html` con doppio click, che invece **non funziona** per via delle
restrizioni di sicurezza sul caricamento di script/wasm locali).

## Come si usa

1. Clicca "Seleziona cartella immagini" e scegli la cartella con le figurine.
   Il browser chiederà il permesso di lettura/scrittura su quella cartella.
2. Disegna l'area/e col mouse sulla prima immagine (come nel tool desktop).
3. Imposta autore, orientamento, numero di aree.
4. "ESEGUI STEP 1": OCR + scrittura IPTC/XMP, **direttamente sui file
   originali nella cartella** (nessun download, nessun upload).
5. Carica l'Excel della checklist.
6. "ESEGUI STEP 2": match fuzzy + scrittura della stringa finale.
7. Se ci sono file senza match, scarica il report con il pulsante che appare.

## Struttura del progetto

```
index.html          pagina principale
style.css
app.js               logica dell'app (OCR, canvas, metadati, matching)
js/matcher.js        porting JS di difflib.SequenceMatcher (testato contro Python)
js/textutils.js       pulizia caratteri speciali + similarity (testato contro Python)
vendor/tesseract/      tesseract.js + core WASM (bundle locale, no CDN)
vendor/tessdata/       dati lingua inglese per l'OCR (bundle locale)
vendor/exiv2/           exiv2-wasm: lettura/scrittura IPTC/XMP (bundle locale)
vendor/xlsx/            SheetJS per leggere il file Excel (bundle locale)
```

## Differenze rispetto al tool desktop / versione server

- Scrive **direttamente** nella cartella scelta (come il tool desktop),
  niente zip da scaricare.
- Non c'è più bisogno di ExifTool installato: lo sostituisce exiv2-wasm.
- Non c'è più bisogno di Tesseract installato: lo sostituisce tesseract.js.
- Nessun costo di hosting ricorrente se usi GitHub Pages (gratuito).
- Non c'è ancora un vero backup automatico prima della sovrascrittura (il
  tool desktop lo fa). Se vuoi, lo aggiungo: prima di scrivere, potremmo
  copiare i file originali in una sottocartella `_BACKUP_<timestamp>`
  usando sempre la File System Access API.
