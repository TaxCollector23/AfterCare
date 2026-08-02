# DischargeGuide backend scaffold

The API is an Express service in `apps/api`. Person B owns its routes, middleware, data,
storage, Google Drive integration, and queue. It currently runs in safe placeholder mode:

1. `POST /upload` accepts PDF, JPG, or PNG files in memory and creates a document ID.
2. A retrying job queue calls Person A's typed `runPipeline(documentId, emit)` handoff.
3. `GET /process/:documentId` streams stored and live events using Server-Sent Events.
4. Dashboard routes return a stable, typed recovery-plan contract.
5. Google Drive OAuth is limited to `drive.file`; imports and backups stay unavailable until configured.
6. Original files are encrypted with AES-256-GCM before private S3 storage (memory storage locally).
7. JWT auth, per-user rate limits, audit logging, PostgreSQL migrations, and a dead-letter queue are included.

When no AI credentials are configured, processing fails closed with a sanitized,
retryable `AI_PROVIDER_UNAVAILABLE` response. The API never substitutes invented
medications, appointments, warnings, or other clinical information.

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
- Add malware scanning and explicit retention/deletion controls.
- Add deployment monitoring and alerting once the Render service is provisioned.
