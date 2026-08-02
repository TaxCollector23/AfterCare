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

Placeholder mode never invents clinical data. Empty OCR results propagate as empty medication,
appointment, warning, and timeline lists. `/ask` refuses to make a clinical claim, returns zero
confidence, and tells the user to check the original document.

## Local development

```bash
pnpm install
pnpm dev
```

Set `WEB_ORIGIN` and `PORT` for the local environment. Copy `apps/api/.env.example` to `.env`
and supply database, encryption, S3, JWT, and Google credentials before production use. Run
`pnpm --filter @discharge-guide/api migrate` to apply the PostgreSQL schema.

## Production gaps

- Wire the repository interface to PostgreSQL for durable runtime data; current local API data is in memory.
- Persist Google refresh tokens encrypted rather than in process memory.
- Add malware scanning and explicit retention/deletion controls.
- Person A replaces only the typed `runPipeline` and `askGrounded` mocks.
