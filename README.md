# AfterCare

**Understand your own discharge paperwork.**

You get handed six pages on your way out of the hospital, on the worst day of your
month, and somewhere in there is which pill to stop, which to keep, when to come
back, and which symptom means *go to the ER now*. Roughly one in five Medicare
patients is readmitted within 30 days, and misunderstood discharge instructions are
a well-documented contributor.

AfterCare reads that document and turns it into a plan: medications with a schedule,
appointments, a timeline, and a pinned emergency screen. It runs on a phone, reads
itself aloud, and works for the family member doing the caregiving.

**Live:** https://aftercare-web-eta.vercel.app

---

## The one rule

**AfterCare never invents clinical information.** Not a dose, not a date, not a
warning sign. Everything it shows is traced to a specific line of the uploaded
document, and when it isn't confident, it says so and points back at the original.

This constraint drove most of the architecture below. It is the difference between
a medical tool and a plausible-sounding liability.

Discharge communication failure is a patient-safety problem in the clinical sense
of the term — it is a leading contributor to avoidable readmission. So safety here
isn't the topic sitting on top of the app; it's the constraint the system is built
around. Three places it shows up in the code rather than the pitch:

- **The model's grounding claim is verified, not believed.** Cited line numbers are
  re-checked against the real OCR line set; an uncited "from your document" answer
  is demoted to general information with its confidence capped.
- **It fails closed.** With no AI credentials, or during a provider outage,
  processing returns a sanitized retryable error. It never substitutes invented
  medications, appointments, or warnings to fill the gap.
- **Uncertainty is surfaced, not smoothed over.** Below-threshold confidence renders
  as "check the original document" instead of being presented as settled fact.

The failure mode we designed against isn't downtime. It's a confident wrong dose.

---

## Why this isn't an LLM wrapper

A wrapper is one prompt and one response. The failure mode of a wrapper in a medical
context is that it confidently makes up a dosage. Most of this codebase exists to
make that impossible.

**Seven-stage pipeline with independent degradation.**
`ocr → extract → meds → appts → warnings → timeline → explain`

OCR and extraction are load-bearing — if they fail, the run stops honestly. The five
detection stages degrade *independently*: an unreadable medication table yields an
empty medication list and a reported error for that stage, not an empty dashboard.
One bad section can't take down the whole guide.

**Grounding is verified, not trusted.** The model is asked to cite line numbers.
Every citation is then checked against the actual OCR line set, and any line that
doesn't exist is dropped. If a claimed document-sourced answer survives with no
real citations, it is *demoted* to "general information" and its confidence is
capped below threshold. The model's own claim that it was grounded is treated as
an assertion to verify, not a fact.

**Every fact carries provenance.** Each extracted item has `sourceLines` pointing at
numbered OCR text plus a 0–100 confidence. Below threshold, the UI surfaces "check
the original document" instead of presenting it as settled.

**Provider waterfall.** OpenAI for text, Gemini for vision, OpenRouter free tier as
fallback, with per-call timeouts. A provider outage degrades to a sanitized,
retryable error — never to a silent wrong answer or a leaked upstream error.

**Text layer vs. vision.** PDFs with a real text layer skip OCR; scans and photos
fall back to vision transcription, decided by a characters-per-page heuristic.

**Streaming that survives a refresh.** `/process/:id` is Server-Sent Events, and the
queue keeps per-document event history — reconnecting replays what you missed rather
than restarting. Because `EventSource` can't send an `Authorization` header, the
client consumes the stream with `fetch` + a streaming reader instead.

**Operational care.** AES-256-GCM encryption at rest with a per-upload IV, uploads
deduplicated by SHA-256 so the same document isn't reprocessed or re-billed, retry
with exponential backoff, a dead-letter queue, JWT auth, per-user rate limits, and
HIPAA-shaped audit logging.

**115 tests across 22 files**, including grounding, the provider waterfall, and
end-to-end upload regressions.

---

## It always loads

Three runtime modes, detected at startup, degrading silently:

| Mode | When | What works |
| --- | --- | --- |
| `backend` | the API answers `/health` | full pipeline |
| `firebase` | Firebase env vars present | auth, sync, storage |
| `local` | nothing configured | everything stays in your browser |

No configuration produces a blank page or a crash. With zero setup the site loads
and stores documents locally — the guide fills in once a backend is connected.

---

## Architecture

```
apps/web            Vite + React SPA          → Vercel
apps/api            Express API + pipeline    → Render (Docker)
apps/android        TWA wrapper
packages/shared-types   contracts both sides import
packages/ui-kit
```

The browser calls `/api`, which Vercel rewrites to the Render service — so requests
are same-origin and CORS never enters the picture.

## Running it

```bash
pnpm install
pnpm dev
```

That's the whole setup. It runs in local mode with no keys at all. To run the
pipeline, add an AI key to `apps/api/.env` and `pnpm dev:api`.

```bash
pnpm test        # API + pipeline suites
pnpm typecheck
pnpm lint
```

See [docs/architecture.md](docs/architecture.md) for deployment and environment
variables, and [docs/api-openapi.yaml](docs/api-openapi.yaml) for the API contract.

---

## Known gaps

Honest list, since these are real:

- **Storage is in-memory.** Documents and plans do not survive a restart. Needs
  `DATABASE_URL` and S3 for durability.
- Google refresh tokens are held in process memory rather than encrypted at rest.
- No malware scanning on upload, and no retention/deletion controls yet.
- Free-tier hosting sleeps when idle, so the first request after a quiet period is
  slow.

---

## Not medical advice

AfterCare explains a document you already have. It does not diagnose, does not
recommend treatment, and does not replace your care team.
