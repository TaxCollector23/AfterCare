# AfterCare — web app

Turns a patient's own discharge paperwork — a PDF, a photo of a report, or a file
from Google Drive — into a plain-language, read-aloud recovery guide.

## It always runs

There is no configuration gate. The app detects what's available at startup and
picks the best mode it can:

| Mode | When | What it does |
| --- | --- | --- |
| `backend` | `<VITE_API_BASE_URL or /api>/health` answers | Full pipeline: server-side OCR + extraction, JWT accounts |
| `firebase` | Firebase env vars present | Firebase Auth + Firestore + Storage |
| `local` | nothing configured | No sign-in. Files in IndexedDB, metadata in localStorage |

Detection is a single `/health` probe with a 4s timeout that never throws. If the
backend disappears, the app falls back rather than breaking — so the site loads
and stays usable no matter what.

In `local` mode the guide starts empty and fills in once a processing backend is
connected. It never invents clinical content.

## Setup

```bash
pnpm install          # from the repo root
pnpm --filter @dischargeguide/web dev
```

Copy `.env.example` to `.env.local` to enable optional services. **Read the
warning at the top of that file:** every `VITE_` variable is compiled into the
browser bundle and is public. Server secrets (`OPENAI_API_KEY`, `GEMINI_API_KEY_*`,
`DATABASE_URL`, `JWT_*`) belong to `apps/api`, never here.

### Where each key goes

| Key | Project | Why |
| --- | --- | --- |
| `VITE_FIREBASE_*` | web | Public by design; guarded by security rules |
| `VITE_GOOGLE_DRIVE_*` | web | Browser-side picker; restrict by HTTP referrer |
| `VITE_ELEVENLABS_API_KEY`, `VITE_GOOGLE_TTS_API_KEY` | web | Called from the browser — restrict by referrer, or proxy via the API |
| `OPENAI_API_KEY`, `GEMINI_API_KEY_*` | **api** | Secret. Must stay server-side |
| `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `S3_BUCKET` | **api** | Secret |

## Connecting the backend

Run the API and point the web app at it:

```bash
# terminal 1
cd apps/api && WEB_ORIGIN=http://localhost:5173 pnpm dev

# terminal 2
echo "VITE_API_BASE_URL=http://localhost:3001" > apps/web/.env.local
pnpm --filter @dischargeguide/web dev
```

`WEB_ORIGIN` must exactly match the web origin or CORS blocks the probe and the
app quietly falls back to local mode.

### Before deploying the API

`apps/api/src/db/repository.ts` currently keeps **all** state in in-memory `Map`s —
it never reads or writes the Postgres pool in `db/client.ts`, and the pipeline
queue is in-memory as well. That means:

- It must run as a **single long-lived process**. On serverless (Vercel functions,
  Lambda) an upload and its `/process` stream can land on different instances, and
  the second one returns "Document not found".
- All accounts and documents are lost on restart.

Wiring `repository.ts` to the existing `001_initial.sql` schema is the prerequisite
for deploying it anywhere real.

## Deploying the web app

Static Vite build (`pnpm --filter @dischargeguide/web build` → `dist/`).
`vercel.json` rewrites all paths to `index.html` for client-side routing. Set any
`VITE_*` variables in the host's dashboard — they are read at **build** time, so
redeploy after changing them.
