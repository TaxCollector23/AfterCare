# DischargeGuide backend scaffold

The API is an Express service in `apps/api`. Person B owns its routes, middleware, data,
storage, Google Drive integration, and queue. It currently runs in safe placeholder mode:

1. `POST /upload` accepts PDF, JPG, or PNG files in memory and creates a document ID.
2. A retrying job queue calls Person A's typed `runPipeline(documentId, emit)` handoff.
3. `GET /process/:documentId` streams stored and live events using Server-Sent Events.
4. Dashboard routes return a stable, typed recovery-plan contract.
5. Google Drive OAuth is limited to `drive.file`; imports and backups stay unavailable until configured.
6. Original files are encrypted with AES-256-GCM before private S3 storage (memory storage locally).
7. JWT auth with access-token refresh rotation and logout, per-user rate
   limits, audit logging, PostgreSQL migrations, and a dead-letter queue are
   included. Refresh tokens carry a unique `jti`, are stored hashed with
   bcrypt, and are rotated on every `POST /auth/refresh`; reuse of a rotated
   token revokes the whole session family.
8. `DELETE /documents/:documentId` lets the owner delete a document, its
   stored (encrypted) file, plan, medications, appointments, and adherence
   records for retention control.

When no AI credentials are configured, processing fails closed with a sanitized,
retryable `AI_PROVIDER_UNAVAILABLE` response. The API never substitutes invented
medications, appointments, warnings, or other clinical information.

### AI provider waterfall (free-tier friendly)

Every LLM call goes through a single waterfall (`integrations/aiProviderWaterfall.ts`)
that tries providers in order and falls through on retryable failures (rate limits,
quotas, timeouts, 5xx, network):

1. **OpenAI** — paid, strongest (default `gpt-4o-mini`).
2. **OpenRouter** — free `:free` models by default
   (`deepseek/deepseek-chat-v3-0324:free`), reached via the OpenAI-compatible
   endpoint `https://openrouter.ai/api/v1`. JSON output is shaped by the schema
   hint in the system prompt plus lenient JSON parsing (free models don't all
   honor `response_format`).
3. **Gemini primary / fallback** — free tier, default `gemini-2.5-flash` (the
   current best free-tier model for JSON extraction and vision/OCR).

Vision/OCR transcription stays on **OpenAI → Gemini only** because the default free
OpenRouter models are text-only.

Per-provider request timeout defaults to 45s and is configurable via `AI_TIMEOUT_MS`.
Each provider also gets bounded backoff retries for transient failures.

### LLM judge stage

After extraction, the pipeline runs an independent **judge** stage
(`pipeline/judge.ts`) that re-reads the numbered source text and verifies every
medication, appointment, and warning against it:

- `pass` → kept as extracted.
- `review` → kept, confidence capped below the review threshold so the UI shows
  the "please check the original document" banner.
- `fail` → dropped entirely (an unsupported finding must never reach the patient).

Verdicts for ids the pipeline never emitted are ignored, missing verdicts default to
`review`, and a judge failure degrades gracefully (original findings are kept). A
dedicated judge model can be set with `JUDGE_MODEL` (defaults to the main text model).

### Ops & performance

- `GET /health` reports which AI providers are configured in the waterfall
  (`ai.waterfall`, booleans only — never keys) and the `AI_TIMEOUT_MS` value.
- `GEMINI_FALLBACK_MODEL` lets the Gemini fallback slot use a cheaper model
  (e.g. `gemini-2.5-flash-lite`) while the primary slot keeps the full model.
- `/ask` reuses a short-TTL, process-local OCR cache keyed by file hash, so
  follow-up questions on the same document skip re-running OCR (expensive for
  scanned PDFs). Only successful OCR results are cached.

## Local development

```bash
pnpm install
pnpm dev
```

Set `WEB_ORIGIN` and `PORT` for the local environment. Copy `apps/api/.env.example` to `.env`
and supply database, encryption, S3, JWT, and Google credentials before production use. Run
`pnpm --filter @discharge-guide/api migrate` to apply the PostgreSQL schema.

## Deployment

The Vite frontend is deployed by Vercel using the root `vercel.json`. Set
`VITE_API_BASE_URL` in the Vercel project to the public HTTPS origin of the Render API.
The remaining `VITE_*` variables in `apps/web/.env.example` are optional browser-side
integrations and must never contain server secrets.

The root `render.yaml` defines the Express API as a Docker web service. Render generates
the JWT secrets and restricts CORS to
`https://aftercare-web-eta.vercel.app`. Enter `OPENAI_API_KEY`,
`GEMINI_API_KEY_PRIMARY`, and `GEMINI_API_KEY_FALLBACK` in the Render Blueprint setup;
the Blueprint never stores their values in Git. Also enter a base64-encoded 32-byte
`STORAGE_ENCRYPTION_KEY`. Add database, S3, or Google Drive
credentials in Render only when those integrations are intentionally enabled.

The API health endpoint is `/health`. Render's service logs include build output,
startup failures, health-check failures, and sanitized request audit events.

## Production gaps

- Wire the repository interface to PostgreSQL for durable runtime data; current local API data is in memory.
- Persist Google refresh tokens encrypted rather than in process memory.
- Add malware scanning and explicit retention/deletion policies at the account level.
- Add deployment monitoring and alerting once the Render service is provisioned.
