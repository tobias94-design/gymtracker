# 🏋️ GymTracker

App personale per tracciare allenamenti, monitorare la progressione dei carichi e analizzare i dati di training.

**Stack:** React + Vite · Firebase Auth + Firestore · Recharts · SheetJS · GitHub Pages

---

## 🚀 Setup in 5 passi

### 1. Clona e installa

```bash
git clone https://github.com/tobias94-design/gymtracker.git
cd gymtracker
npm install
```

### 2. Crea il progetto Firebase

1. Vai su https://console.firebase.google.com
2. "Add project" → nome: `gymtracker` → Create
3. "Add app" → icona Web `</>` → nome: `gymtracker` → Register
4. Copia il `firebaseConfig` mostrato

### 3. Attiva Authentication e Firestore

**Authentication:**
- Firebase Console → Authentication → Get started
- Sign-in method → Email/Password → Enable → Save

**Firestore:**
- Firebase Console → Firestore Database → Create database
- "Start in test mode" → Region: `europe-west3` → Done

**Firestore Security Rules** (Console → Firestore → Rules → Edit):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Configura le variabili d'ambiente

```bash
cp .env.example .env.local
```

Apri `.env.local` e incolla i valori dal firebaseConfig:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=gymtracker-xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gymtracker-xxxx
VITE_FIREBASE_STORAGE_BUCKET=gymtracker-xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 5. Avvia in locale

```bash
npm run dev
```

Apri: http://localhost:5173/gymtracker/

---

## 🌐 Deploy su GitHub Pages

### Aggiungi i Secrets su GitHub

1. GitHub repo → Settings → Secrets and variables → Actions → New repository secret
2. Aggiungi questi 6 secrets (uno per uno, stessi valori di .env.local):
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_STORAGE_BUCKET
   - VITE_FIREBASE_MESSAGING_SENDER_ID
   - VITE_FIREBASE_APP_ID

### Attiva GitHub Pages

1. GitHub repo → Settings → Pages
2. Source: **GitHub Actions** (non "Deploy from a branch")

### Deploy

```bash
git add .
git commit -m "feat: initial gymtracker"
git push origin main
```

GitHub Actions builderà e deployerà automaticamente.
App live su: https://tobias94-design.github.io/gymtracker/

---

## 📋 Formato Excel

Il file deve avere i blocchi per ogni giorno separati da righe vuote:

```
SETTIMANA 1        |            | SETTIMANA 2 | ...
ESERCIZIO | SERIE  | RIPETIZIONI | RECUPERO | KG | SERIE | ...
chest press | 4   | 8           | 1'30"    | 60 | 4     | ...
```

Ogni blocco nello stesso foglio = un giorno (A, B, C, D).

---

## 📱 Installare come app (PWA)

- iPhone/iPad: Safari → Condividi → "Aggiungi a schermata Home"
- Android: Chrome → Menu → "Aggiungi a schermata Home"
- Desktop: Chrome/Edge → icona installa nella barra URL

---

## 🗂 Struttura progetto

```
src/
├── components/Navbar.jsx        # Navigazione responsive
├── context/AuthContext.jsx      # Firebase Auth
├── pages/
│   ├── LoginPage.jsx            # Login / Registrazione
│   ├── DashboardPage.jsx        # Overview + stats + heatmap
│   ├── WorkoutPage.jsx          # Form allenamento interattivo
│   ├── SchedulesPage.jsx        # Upload schede Excel
│   └── AnalyticsPage.jsx        # Grafici progressione
├── utils/
│   ├── excelParser.js           # Parsing .xlsx
│   └── db.js                    # CRUD Firestore
└── index.css                    # Design system bianco/nero/rosso
```
