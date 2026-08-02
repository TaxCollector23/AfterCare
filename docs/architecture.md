# DischargeGuide backend scaffold

The API is an Express service in `apps/api`. It currently runs in safe placeholder mode:

1. `POST /upload` accepts PDF, JPG, or PNG files in memory and creates a document ID.
2. The independent pipeline modules run in sequence and publish progress events.
3. `GET /process/:documentId` streams stored and live events using Server-Sent Events.
4. Dashboard routes return a stable, typed recovery-plan contract.
5. Anthropic and Google Drive are adapters with explicit mock/configuration status.

Placeholder mode never invents clinical data. Empty OCR results propagate as empty medication,
appointment, warning, and timeline lists. `/ask` refuses to make a clinical claim, returns zero
confidence, and tells the user to check the original document.

## Local development

```bash
pnpm install
pnpm dev
```

The API listens on `http://localhost:3001`. Copy `apps/api/.env.example` to `.env` when provider
credentials are ready. Keep `MOCK_INTEGRATIONS=true` until live implementations and safety tests
are complete.

## Production gaps

- Replace development identity middleware with JWT access and refresh tokens.
- Persist users, documents, plans, and audit events in encrypted storage.
- Select and implement OCR; preserve source line mappings.
- Complete the Anthropic adapter with source-only prompting and response validation.
- Complete Google OAuth callback, encrypted token storage, Picker import, and backup.
- Add rate limiting, malware scanning, a job queue, Redis, and retention/deletion controls.
