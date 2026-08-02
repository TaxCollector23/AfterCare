# AfterCare — web app

Turns a patient's own discharge paperwork — a PDF, a photo of a report, or a file from Google
Drive — into a plain-language, read-aloud recovery guide.

## Status

This app is wired up for real auth, storage, and data — but it needs your project's own keys
before it does anything. Nothing is faked: with no keys configured, every screen tells you
exactly what's missing instead of showing fake data.

- **Firebase** (Auth + Firestore + Storage) — required for sign-in, uploads, and everything
  under `/dashboard`.
- **Google Drive connector** — optional. Without it, the "Connect from Google Drive" button
  is disabled with an explanation; direct PDF/photo upload still works.
- **Read-aloud voice** — optional. Without an ElevenLabs or Google Cloud TTS key, "Read this
  page to me" uses the browser's built-in voice, which needs no setup at all.
- **apps/api backend** (OCR/extraction/medication/appointment/warning pipeline) — not built yet.
  Until it exists, uploaded documents will sit at "Waiting to process" forever, which is the
  honest state to show rather than inventing data.

## Setup

```bash
cd apps/web
cp .env.example .env.local
# fill in .env.local with your Firebase project + (optional) Google Drive keys
npm install
npm run dev
```

### Getting Firebase keys

1. Create a project at https://console.firebase.google.com
2. Enable **Authentication → Email/Password**, **Firestore**, and **Storage**.
3. Project settings → General → "Your apps" → add a Web app → copy the config into
   `.env.local` (`VITE_FIREBASE_*`).
4. Deploy the security rules from the repo root:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add            # pick your project
   firebase deploy --only firestore:rules,storage
   ```
   The rules in `/firestore.rules` and `/storage.rules` restrict every document and file to its
   owner (plus any caregiver emails the owner explicitly grants access to in-app).

### Getting Google Drive keys (optional)

1. https://console.cloud.google.com → APIs & Services → enable **Google Picker API** and
   **Google Drive API**.
2. Credentials → create an **OAuth 2.0 Client ID** (type: Web application) → add your app's
   origin (e.g. `http://localhost:5173` and your Vercel domain) to Authorized JavaScript origins
   → put the client ID in `VITE_GOOGLE_DRIVE_CLIENT_ID`.
3. Credentials → create an **API key**, restrict it to the Picker + Drive APIs → put it in
   `VITE_GOOGLE_DRIVE_API_KEY`.

### Getting a read-aloud voice key (optional)

Leave all three blank to use the browser's built-in voice — it already works with no setup.
To use a nicer voice instead:

- **ElevenLabs**: https://elevenlabs.io → profile → API key → `VITE_ELEVENLABS_API_KEY`.
  Optionally set `VITE_ELEVENLABS_VOICE_ID` to a specific voice (defaults to "Rachel").
- **Google Cloud TTS**: https://console.cloud.google.com → enable **Cloud Text-to-Speech API**
  → Credentials → API key → `VITE_GOOGLE_TTS_API_KEY`.

If both are set, ElevenLabs is used. If a request to either fails, the read-aloud button shows
the error instead of silently falling back, so a misconfigured key is easy to spot.

## Deploying

This is a static Vite build (`npm run build` → `dist/`), deployable anywhere that serves
static files. Set the same `VITE_*` env vars in your hosting provider's dashboard (e.g. Vercel
project settings → Environment Variables) — they're needed at **build** time, not just runtime.
