# IMPROVEMENTS — AfterCare (dischargeguide)

> An engineering and product review of the codebase, based on a full read of the source,
> a lint run, a strict TypeScript check, and searches for dead code / unused dependencies.
>
> **Baseline health check (verified today):**
> - `npm run lint` → ✅ passes (ESLint, zero warnings)
> - `npx tsc --noEmit` → ✅ passes (strict mode, zero errors)
> - Test suite → ❌ **none exists** (no `*.test.*` files, no test runner configured)
> - CI → ❌ none
> - API routes / backend → ❌ none (fully static demo)

---

## 1. Executive summary

The UI foundation is genuinely strong: a coherent design-token system, thoughtful
accessibility work (skip link, focus rings, reduced motion, dark/high-contrast/large-text
modes), polished micro-interactions, and clean, consistent component APIs. The product
concept — turning an indecipherable hospital discharge summary into a calm, daily recovery
plan — is compelling.

The gaps are all in the "make it a real product" layer:

1. **No data layer or persistence.** Every interaction (tasks, hydration, "mark taken",
   settings) lives in local component state or `localStorage`; the app resets on reload and
   has no way to ingest a real discharge summary.
2. **Dead code and unused dependencies.** 9 packages are installed but never imported, and 2
   exported UI components are never used.
3. **Wireframe buttons.** Directions, Add to Calendar, Refill, Sign Out, the notification
   bell — all render but do nothing.
4. **A healthcare app with no compliance or clinical-content posture.** For a medical
   product, content sign-off, PHI handling, and privacy policy are not optional.
5. **Zero tests, no CI, no error boundaries, no offline support.**

The rest of this document is a prioritized, file-by-file plan.

---

## 2. P0 — Foundations (fix first)

### 2.1 Replace the hardcoded data layer with persistence + a real source

**Problem:** `src/lib/data.ts` and `src/lib/document-data.ts` are the entire "backend."
All state (`TasksCard`, `HydrationCard`, `MedicationCard`'s `taken`, documents flow) is
component-local and lost on navigation/reload.

**Recommendations (in order of effort):**

- **Now:** Persist user-interaction state to `localStorage` behind a tiny custom hook
  (`usePersistentState<T>(key, initial)`), mirroring the `SettingsProvider` pattern that
  already exists. Apply to: task checkboxes, hydration count, medication "taken" state.
  Tasks `done` and medication `history` are the same concept — unify them.
- **Next:** Model the app around a real discharge document. Parse a structured
  representation (JSON or XML) and *derive* medications, tasks, restrictions, appointments,
  and FAQs from it — instead of hand-maintaining five parallel arrays that can drift
  (they already do: `medications` in `data.ts` vs. the medication text in `document-data.ts`
  must be reconciled by hand).
- **Later:** Route handlers (`app/api/*`) + a database (see §9 for provider guidance), with
  server components fetching and client components mutating.

### 2.2 Delete dead code and unused dependencies

Verified with `ripgrep` — these are **installed in `package.json` but imported nowhere**:

| Package | Status |
|---|---|
| `@radix-ui/react-label` | unused |
| `@radix-ui/react-progress` | unused (the app ships a hand-rolled `ProgressRing` SVG) |
| `@radix-ui/react-tabs` | unused |
| `@radix-ui/react-tooltip` | unused |
| `framer-motion` | unused |
| `react-hook-form` | unused |
| `@hookform/resolvers` | unused |
| `zod` | unused |
| `geist` | unused (fonts come from `next/font/google`) |

**Dead components:** `SplitButton` (`src/components/ui/split-button.tsx`) and
`ButtonGroup` (`src/components/ui/button.tsx`) are exported but never imported. Either use
them or remove them. (They're well-built — the SearchPalette or Documents upload button is
a natural home for `SplitButton`.)

Remove unused deps with `npm uninstall`, add a `typecheck` script, and consider
`knip`/`depcheck` in CI to keep this from regressing.

### 2.3 Wire up or remove the inert UI

Every one of these renders but has no handler or href:

- **"Directions" / "Add to Calendar"** buttons — `src/app/appointments/page.tsx`,
  `src/components/dashboard/appointment-card.tsx`. "Directions" should deep-link to
  `https://maps.google.com/?q=<address>`; "Add to Calendar" should generate a `.ics`
  download (10 lines of code) or at minimum an `href="webcal://…"`.
- **"Refill"** button — `medication-card.tsx` (compact variant). Needs a refill flow
  (pharmacy link, request form, or "notify me").
- **"Sign Out" / "My Profile"** — `top-nav.tsx` dropdown. If there's no auth, remove the
  menu items or mark them `disabled`; a fake logout is worse than no logout.
- **Notification bell** — `top-nav.tsx` renders an unread dot but has no menu, no count
  change, no click behavior. Either implement a small dropdown (2–3 sample notifications
  from `data.ts`) or remove the dot.
- **"Mark Taken"** (compact variant) — `medication-summary-card.tsx` shows the compact card
  without the button; fine, but confirm intent.

### 2.4 Add Next.js error-handling and meta scaffolding

The app has no `error.tsx`, `loading.tsx`, or `not-found.tsx` anywhere under `src/app/`, and
only the root layout sets `Metadata`.

- Add `src/app/error.tsx` (with a "call your care team" fallback — on-brand and useful) and
  `src/app/not-found.tsx`.
- Set per-page `Metadata` (medications, appointments, etc.), plus `viewport`,
  `themeColor`, and a proper `description`. SEO doesn't matter here; **sharing does** — a
  caregiver will send these links to family.
- The Documents page already models "Connection lost" as a UI state — good; now make it real
  with a client-side connectivity listener or graceful API failure handling.

### 2.5 Clinical content review (this is a medical product)

The copy is well-written and appropriately cautious ("call your care team," "911"), but:

- **Every medical statement needs clinician sign-off** and a documented source. Add a
  `CONTENT_REVIEW.md` log: who reviewed, what date, what changed.
- **Plain-language check:** target ~6th-grade reading level (SMOG/Flesch). "Weight-bearing as
  tolerated" is a good example of successfully translated jargon — keep that bar.
- **Emergency thresholds must match the care team's actual protocols.** `data.ts` FAQ says
  "fever >101.5°F" while `emergency-card.tsx` says "fever over 101°F" and the doc
  explanation says "101.5°F" — three different numbers in one codebase. Pick one and
  single-source it.
- Make the "not medical advice, always call your provider" disclaimer visible on every page
  footer, not just implied.

---

## 3. P1 — Architecture

### 3.1 Be deliberate about server vs. client components

Currently the split is arbitrary: the dashboard is a server component that renders client
children, the medications page is a server component rendering client cards, but `page.tsx`
files for settings/documents/questions are `"use client"` even though only small parts need
interactivity. Recommendation:

- Keep static content (FAQ data, diet lists, restrictions) in **server components** and pass
  data down.
- Confine `"use client"` to the interactive leaves (cards, palette, toggles). This shrinks
  the JS bundle meaningfully — the FAQ page and documents page currently ship all their
  interactivity client-side for no reason.

### 3.2 Introduce a client-side store for user state

When tasks, hydration, and medication adherence all need persistence + cross-component
reads (e.g., dashboard summary reflecting the medications page), lift them into one
`RecoveryProvider` (same pattern as `SettingsProvider`) or a lightweight store. This enables
the "medication taken → updates today's tasks" cross-link that a real product needs.

### 3.3 Kill the dev-only preview in production UI

`src/app/documents/page.tsx` ships a "Preview:" `<select>` cycling through simulated states.
It's great for demos — gate it behind `process.env.NODE_ENV !== "production"` (or a
`next.config` experimental flag) so it can't ship.

### 3.4 Fix time handling before it rots

- `data.ts` computes `nextDoseAt` as `Date.now() + offset` at module load — fine for a demo,
  but it means SSR and client can disagree if a server component ever renders a medication.
- Appointments are hardcoded to **Aug 2026** and the hero says **"Day 3 of Recovery"**
  hardcoded. Derive "Day N" from the actual surgery date (add `surgeryDate` to data) so the
  timeline, hero, and countdowns stay consistent forever.
- Centralize "now" behind an injectable clock so tests can be deterministic.

### 3.5 Reduce duplication

- `restrictions` in `data.ts` is mirrored in the documents explanations; `medications` in
  `data.ts` duplicates the medication list in `document-data.ts`. If the doc is the source of
  truth, generate both (see 2.1).
- `AppointmentCard` vs. `src/app/appointments/page.tsx` share nearly identical markup — extract
  a shared `AppointmentCard` with a `size`/`variant` prop (same pattern as `MedicationCard`).

---

## 4. P2 — Accessibility & design-system refinements

### 4.1 The "Large Text" mode is broken for some controls (verified)

`globals.css` implements `--scale` to grow all type, and custom `text-h1…text-small`
classes honor it — **but hardcoded pixel sizes bypass it**:

- `src/components/ui/button.tsx` — `text-[16px]` (default) and `text-[15px]` (sm)
- `src/components/ui/split-button.tsx` — `text-[16px]`
- `src/components/documents/split-viewer.tsx` — `text-[11px]`

Fix: replace with `text-small`/`text-body` or `calc(16px * var(--scale))`. Then add an a11y
regression check: flip on Large Text and confirm nothing clips or overflows.

### 4.2 Semantic controls

- `split-viewer.tsx` explanation cards are `role="button"` `div`s with a manual
  `onKeyDown` — use a real `<button>` and get focus management + screen-reader semantics for
  free.
- `SearchPalette` input sets `role="combobox"` + `aria-activedescendant` but the value can
  be stale when `results` shrinks below `activeIndex` (e.g., delete characters while an item
  is highlighted → `activeIndex` points past the list). Clamp `activeIndex` whenever
  `results.length` changes, and reset it on open.
- Verify all Radix `aria-label`s on interactive icons (Bell, ChevronDown, close buttons) are
  meaningful on their own.

### 4.3 Color-only indicators audit

High contrast mode is a great start, but audit for color-only meaning:
- Medication schedule chips use `line-through` for inactive — good (not color-only).
- Timeline "upcoming" uses dashed borders — good.
- Check the `Badge` neutral variant (`bg-slate-100` / `dark:bg-white/10`) against `--scale`
  and contrast in both themes.

### 4.4 Reading/motion polish

- The `text-[11px]` "✓" badge in `split-viewer.tsx` is nearly invisible to the target
  audience (post-op patients, likely older). Use a proper size and `aria-hidden` + adjacent
  visible text (it already has visible text — so just bump the size).
- `scrollIntoView({ behavior: "smooth" })` in `split-viewer.tsx` ignores the reduced-motion
  preference; pass `behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"`.

---

## 5. P2 — Features that turn this into a real product

Priority order (each is independently valuable):

1. **Real document ingestion.** The core promise. Client-side PDF text extraction
   (`pdfjs-dist`) → heuristics to pull diagnosis/procedure/medications → render through the
   existing `SplitViewer`. The current simulated upload flow is already the right UX
   skeleton; swap the `setTimeout` for real parsing and add the "Missing info" path when
   confidence is low (the state already exists!).
2. **Medication reminders & adherence.** Web Push (VAPID) or in-app reminders built on the
   schedule fields; show adherence streaks from `history`. This is the feature most likely to
   justify the app's existence.
3. **Offline support (PWA).** Post-op patients have flaky connectivity (the app even has a
   "Connection lost" state). `next-pwa`/`@serwist` for a service worker + shell caching would
   make the core recovery info available offline.
4. **Caregiver share.** A read-only link or "send to family" that renders the same plan
   without login — pairs with the metadata/sharing work in 2.4.
5. **i18n.** Spanish at minimum; discharge instruction comprehension drops sharply when the
   patient reads a second language. Structure copy so translation is mechanical.
6. **Print-friendly discharge plan.** A single printable page (care team visit prep, or for
   the patient to bring to the pharmacy).

---

## 6. Feature catalog — 50+ features we can build

> This is the "what else could this be" section — an idea catalog organized by product area,
> with effort estimates and notes on what existing code each feature can reuse.
>
> **Effort legend:** S = under a day · M = a few days to a week · L = 1–3 weeks ·
> XL = multi-week or vendor integration.

### 6.1 Daily health tracking & symptom intelligence

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **Daily check-in** | One-tap "How do you feel today?" (great/ok/poor) that feeds a recovery score and powers alerts elsewhere | S | New `CheckInCard`, mirrors `TasksCard` |
| **Pain diary** | 0–10 slider + optional note, logged with timestamps; trend chart over time | M | `ProgressRing` SVG pattern; data model like `history` in `Medication` |
| **Temperature logging** | Daily temp entry + configurable fever alerts using the *unified* threshold from 2.5 | M | Reuse `EmergencyCard` alert styling |
| **Bowel tracker** | Simple "log a movement" — the single most common post-op concern (it's already an FAQ) | S | New small card; counter pattern like `HydrationCard` |
| **Sleep log** | Wake/sleep times + quality; night-time rest matters for recovery | S | Same pattern as hydration |
| **Symptom trends** | Line/bar charts (pain, temp, mood, sleep) over 7/14/30 days | M | Hand-rolled SVG like `ProgressRing` or a chart lib |
| **Weekly recovery report** | Auto-generated plain-language summary — "bring this to your follow-up" | M | Uses the above; renders as a printable page (ties to §5 item 6) |

### 6.2 Medication intelligence

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **Real reminders** | Web Push (VAPID) + in-app notifications for each `schedule` slot, with snooze (10 min / 1 h) | M | `MedicationCard` schedule chips already model the data |
| **Adherence streaks** | "3 days in a row" counts from `history`; gentle encouragement, never shaming | S | Data already exists in `Medication.history` |
| **Missed-dose guidance** | When a dose is skipped, show the right action (already an FAQ: take vs. skip) | S | FAQ content is already written |
| **Pill photo ID** | Photo/barcode scan of a bottle → confirm it's the right med, right dose | L | Camera + lookup; needs a small med database |
| **Interaction checker** | Warn on grapefruit/NSAIDs/OTC combos (content already in FAQs) | M | Rule engine over `Medication` + FAQ data |
| **Refill lifecycle** | Countdown from `refillsLeft`, pharmacy contact, "request refill" flow | M | `refillsLeft` field + the inert Refill button (2.3) |
| **Side-effect reporter** | Tap a side effect → logged, with escalation if severe | M | `sideEffects` field already modeled |

### 6.3 Activity, wound & recovery

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **Wound photo journal** | Date-stamped photo of the incision over time; simple side-by-side comparison | M | Timeline component + file input |
| **Healing checklist** | Red-flag checklist (redness, drainage, odor) with visual examples | M | `EmergencyCard` styling, `Checkbox` |
| **Step counting** | HealthKit/Google Fit steps vs. the "ambulate 3x daily" goal | L | Needs sensor SDK; manual fallback |
| **Sedentary nudge** | "You've been resting a while — short walk?" based on time since last completed walk task | S | `TasksCard` completion data |
| **Milestones & badges** | Celebrate Day 7 suture check, first outside walk, med streak | S | `RecoveryTimeline` + `Badge` |
| **Timeline media** | Attach photo/milestone notes to timeline events | M | `RecoveryTimeline` |

### 6.4 Care team connectivity

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **"Ask a question"** | Secure in-app messaging to the care team with expected response time | M | New page; reuses `Accordion`/`Button` |
| **Telehealth links** | One-tap video call from appointment cards | S | `AppointmentCard` |
| **Pre-visit question builder** | Auto-drafts "questions to ask" from recent symptoms/pain entries | S | Uses 6.1 data |
| **Plan versions** | Each follow-up updates the care plan; "what changed since last visit" view | M | Document flow + `SplitViewer` |
| **Symptom escalation** | High pain/fever scores auto-flag to the care team | M | 6.1 data + backend |

### 6.5 Family, accessibility & reach

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **Caregiver mode** | Read-only share link, delegated task reminders ("remind Dad to walk") | M | Metadata/sharing work from 2.4 |
| **Read-aloud & voice entry** | `speechSynthesis` for instructions; voice input for check-ins | M | Works with existing copy |
| **i18n** | Spanish first, then others | M | Structure copy as data (see §5) |
| **Multi-patient** | Manage a parent + spouse in one account | L | Requires data model change |
| **Offline PWA** | Service worker shell so the plan works with no signal | L | Already has a "Connection lost" state |
| **Email/SMS digest** | Daily plain-text summary for patients who don't use apps | M | Reuse `data.ts` content |

### 6.6 Emergency & safety

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **ICE card + QR** | Lockscreen "in case of emergency" medical card (meds, allergies, surgeon) | S | Derived from `data.ts` |
| **Urgent care locator** | Nearest ER/urgent care with "go now" for red-flag symptoms | S | Maps link; mirrors Directions work (2.3) |
| **Inactivity check-in** | If no interaction for 24h post-op, ping a caregiver | M | Backend job |
| **Emergency contacts** | Manage care team + family contacts, one-tap call | S | `EmergencyCard` |

### 6.7 Integrations & platform

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **EHR/FHIR integration** | Real discharge summaries straight from the hospital | XL | The endgame for the Documents feature |
| **HealthKit / Google Fit** | Pull steps, sleep, weight | L | Vendor SDKs |
| **Real calendar** | .ics download + Google/Apple calendar buttons | S | Fixes 2.3 |
| **Pharmacy coupons** | GoodRx-style pricing links on the refill flow | M | Vendor API |
| **Hospital white-labeling** | Per-hospital branding, logo, contact info, content packs | M | Design tokens already support theming |
| **Admin analytics** | Adherence, readmission-risk flags, cohort views | L | Needs backend |
| **Patient data export** | "Download my data" (JSON/PDF) — trust + regulatory hygiene | S | Reuse print styling |
| **Feature flags / A/B** | Roll out reminders to a cohort first | M | `next.config` + flags service |

### 6.8 Content & education

| Feature | What it does | Effort | Builds on / notes |
|---|---|---|---|
| **Teach-back quiz** | Before-discharge "do you know when to take this?" verification | S | `Checkbox`, `Card`, `Button` |
| **Video library** | Short wound-care/exercise videos with transcripts | M | Embed + transcript accordion |
| **Condition packs** | Ortho/cardiac/general-surgery content variants | M | Content architecture |
| **Reading-level toggle** | Simple vs. detailed explanation of the same doc | S | The whole `SplitViewer` premise |

### 6.9 Quick wins — ship these first (all S effort, all reuse existing UI)

1. Daily check-in + recovery score (6.1)
2. Bowel tracker (6.1)
3. Sleep log (6.1)
4. Adherence streaks (6.2)
5. Missed-dose guidance (6.2)
6. Sedentary nudge (6.3)
7. Milestones & badges (6.3)
8. Telehealth links (6.4)
9. ICE card + QR (6.6)
10. Urgent care locator (6.6)
11. Real calendar buttons (6.7)
12. Patient data export (6.7)
13. Teach-back quiz (6.8)
14. Reading-level toggle (6.8)

Each is a small, self-contained card or page that slots into the existing grid on `/` —
together they turn the demo into a daily-use product.

---

## 7. P3 — Testing & tooling

### 6.1 Unit tests (highest-value targets)

Add **Vitest + React Testing Library** (fast, Vite-based, trivial to wire into Next 16) and
test the pure logic first — it's already nicely separated:

- `countdown.ts` — `formatRemaining` edge cases (0ms, exactly 1h, negative).
- `search-palette.tsx` — `buildResults` matching + `slice(0, 8)` + empty query.
- `settings-provider.tsx` — hydrate → apply DOM attrs → persist; malformed JSON tolerance.
- Component tests for `MedicationCard` (mark taken toggle), `HydrationCard`, `TasksCard`.
- `questions/page.tsx` — category × search filtering.

### 6.2 E2E

**Playwright**: load `/`, toggle a task, use ⌘K search, upload through the documents flow,
flip dark mode, and assert it survives reload (after 2.1 lands). Also run the
`@axe-core/playwright` scan per page.

### 6.3 Tooling / CI

- Add `"typecheck": "tsc --noEmit"` and `"test": "vitest run"` scripts.
- GitHub Actions workflow: `lint` + `typecheck` + `test` + `build` on PR. Add `knip` to flag
  unused exports/deps automatically.
- Optional: Storybook for the design-system primitives (they're already cleanly isolated).

---

## 8. P3 — Security & compliance (healthcare-grade)

This is a health information product; treat the following as requirements, not polish:

- **Threat model:** This prototype's content is generic, but any real deployment processes
  PHI. Decide the compliance target early: HIPAA (US), or a "no PHI, patient-consented"
  product model. That decision changes everything downstream.
- **Encryption:** TLS in transit; encryption at rest for any stored summaries; never log PHI.
- **Minimization:** store the *derived* plan (meds, dates, instructions), not full scanned
  PDFs; delete on account close; define retention.
- **Auth:** real SSO/OAuth (care-team-issued accounts) rather than the mock dropdown.
- **Privacy policy + consent:** in-app, before first upload.
- **Dependency scanning:** `npm audit` in CI + Dependabot.
- **Rate limiting / abuse:** any upload endpoint needs size/type limits and rate limits.

## 9. Choosing a backend (when you get there)

When you're ready to persist data, don't build from memory — use a provider that fits a
Next.js health app. Good first conversations:

- **Database:** Postgres (via Supabase or Neon) — relational fit for patients → meds →
  adherence, row-level security maps naturally to per-patient data.
- **File storage:** S3/R2 (object storage) if keeping original documents.
- **Auth:** Supabase Auth / Clerk / Auth0 (SSO-friendly).
- **Email/reminders:** Resend/Postmark for follow-up and refill notifications.
- **Hosting:** Vercel (zero-config for this app) with the DB fully managed elsewhere.

I'd start with **Supabase (Postgres + Auth + Storage in one) or Neon + a minimal auth**, and
use the Gravity Index to compare before integrating.

---

## 10. Prioritized roadmap

> Rows P0–P2-3 reference sections 2–8; rows P2-4+ reference the feature catalog in §6.

| # | Item | Why now | Section |
|---|------|---------|---------|
| P0-1 | Unify the three fever thresholds + clinical review log | Patient safety | 2.5 |
| P0-2 | localStorage persistence for user state | Product doesn't work across reloads | 2.1 |
| P0-3 | Delete unused deps + dead components | Hygiene; 9 packages ship dead weight | 2.2 |
| P0-4 | Wire or remove inert buttons | Trust; dead controls erode credibility | 2.3 |
| P0-5 | `error.tsx` / `not-found.tsx` / per-page metadata | Resilience + sharing | 2.4 |
| P1-1 | Real PDF ingestion behind the existing flow | The core promise | 5.1 |
| P1-2 | Server/client component audit | Bundle + correctness | 3.1 |
| P1-3 | Single `RecoveryProvider` store | Cross-page state coherence | 3.2 |
| P1-4 | Fix `--scale` bypass in buttons | The "Large Text" a11y feature is broken | 4.1 |
| P1-5 | Gate dev preview; fix split-viewer semantics + motion | A11y + not shipping dev tools | 3.3, 4.2, 4.4 |
| P2-1 | Vitest + Playwright + CI | Currently zero safety net | 7 |
| P2-2 | PWA offline + reminders | Differentiates the product | 5.2, 5.3 |
| P2-3 | Compliance posture (HIPAA/privacy/audit) | Non-negotiable for launch | 8 |
| P2-4 | Daily check-in + pain diary + weekly report | Clinical gold; patients bring it to follow-up | 6.1 |
| P2-5 | Real reminders + snooze + streaks | Turns "mark taken" into a habit tool | 6.2 |
| P2-6 | Care team messaging + telehealth | A real support loop, not a demo | 6.4 |
| P3-1 | ICE card + urgent-care locator | Patient safety | 6.6 |
| P3-2 | i18n + read-aloud | Accessibility reach | 6.5 |
| P3-3 | Quick-wins bundle (§6.9) | 14 small features that ship fast | 6.9 |

---

## 11. What's already excellent (don't touch)

- The design-token system in `globals.css` (dark/high-contrast/large-text/reduced-motion) is
  unusually coherent for a prototype.
- The FOUC-free theme bootstrap (`layout.tsx` inline script + `SettingsProvider` hydration)
  is the correct pattern, done well.
- The documents state machine (empty/uploading/ready/failed/unreadable/missing/offline) is a
  genuinely thoughtful product skeleton — most teams ship only "upload" and "error."
- Accessibility fundamentals (skip link, focus-visible, aria labels, semantic lists) are
  consistently applied.
- The codebase is cleanly organized, typed with `strict`, lints and typechecks with zero
  errors, and every component has a consistent API shape.
