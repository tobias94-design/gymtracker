# 🏋️ GymTracker

Personal workout tracker — ospitato su GitHub Pages.

## Stack
- Vanilla JS + HTML/CSS
- SheetJS (parser Excel, zero backend)
- Chart.js (grafici progressione)
- localStorage (dati salvati nel browser, privati)

## Funzionalità
- 📂 **Import Excel** — carica la tua scheda (.xlsx), parser automatico multi-blocco
- 🏋️ **Tracker sessione** — form interattivo per ogni allenamento, traccia serie/rip/kg in tempo reale
- 📊 **Analytics** — grafici progressione carichi e volume per esercizio
- ✅ **Progressione scheda** — barra avanzamento settimane

## Struttura Excel supportata
Ogni blocco (Scheda A, B, ecc.) deve iniziare con una riga contenente `SETTIMANA 1`.
Colonne: `ESERCIZIO | SERIE | RIPETIZIONI | RECUPERO | KG` ripetute per ogni settimana.

## Deploy su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `gymtracker`)
2. Carica i 3 file: `index.html`, `style.css`, `app.js`
3. Vai su **Settings → Pages → Source: main branch / root**
4. L'app sarà live su `https://tuonome.github.io/gymtracker`

## Note
I dati sono salvati in `localStorage` nel browser — non escono mai dal tuo dispositivo.
Per backup, usa il tasto Export (da aggiungere) o salva manualmente i dati.
