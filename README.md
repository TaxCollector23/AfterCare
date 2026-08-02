# AfterCare — Your Recovery Dashboard

A clear, calm guide to recovering at home after a hospital discharge. AfterCare turns a dense discharge packet into a single dashboard: **medications with live countdowns, daily tasks, appointments, dietary guidance, recovery milestones, and plain-language versions of medical documents** — all in one place.

This repository is a **high-fidelity front-end prototype**. All data is hardcoded TypeScript and every interaction is simulated client-side. There is no backend, database, or auth — the goal is a polished, accessible demonstration of the product concept.

> The demo persona is **Sarah Chen**, a hip-fracture (femur neck) patient recovering at home after ORIF surgery.

---

## Features

- **Recovery dashboard** (`/`) — a 12-column card grid: daily tasks, emergency contacts, medication summary, next appointment, recovery restrictions, hydration tracker, diet guidance, and a full recovery timeline.
- **Medications** (`/medications`) — full medication list with dosage, purpose, food instructions, side effects, refill counts, adherence history, and live "next dose" countdowns.
- **Appointments** (`/appointments`) — follow-up visit cards with doctor, clinic, address, and date/time.
- **Documents** (`/documents`) — simulated PDF upload flow with loading/empty/error states and a **split viewer** that pairs the original document with a plain-language translation.
- **Questions** (`/questions`) — searchable, filterable FAQ accordion covering pain, showering, exercise, driving, diet, and medication.
- **Settings** (`/settings`) — accessibility preferences: light/dark/system theme, high contrast, large text, and reduced motion. Persisted to `localStorage` and applied **before first paint** to avoid theme flash (FOUC).
- **⌘K search palette** — keyboard-driven global search across medications, appointments, and FAQs (Radix Dialog with full arrow/enter navigation).
- **Accessibility-first** — skip-to-content link, semantic landmarks, keyboard-navigable everything, and a CSS-variable design system with four accessibility modes.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.12** (App Router) + React 19 + TypeScript 5 |
| Styling | **Tailwind CSS v4** + a custom CSS-variable design-token system |
| Primitives | **Radix UI** (dialog, dropdown-menu, accordion, switch, checkbox) |
| Icons | `lucide-react` |
| Utilities | `class-variance-authority`, `clsx`, `tailwind-merge` (via the `cn()` helper) |

> ⚠️ **Note:** this project runs a customized Next.js build with some breaking changes versus stock Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before writing code, and note that `next.config.ts` sets a custom turbopack `root`.

## Getting Started

```bash
# install dependencies
npm install

# run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run start   # start the production server
npm run lint    # ESLint
```

There is currently **no test runner** — `lint` and `npx tsc --noEmit` are the only safety nets.

## Project Structure

```
src/
├── app/                    # App Router pages
│   ├── layout.tsx          # Root layout: theme init script, SettingsProvider, TopNav, skip link
│   ├── page.tsx            # Dashboard — 12-col grid of cards
│   ├── medications/        # Full medication list
│   ├── appointments/       # Follow-up visit cards
│   ├── documents/          # PDF upload flow + plain-language split viewer
│   ├── questions/          # Searchable/filterable FAQ accordion
│   └── settings/           # Accessibility/preference toggles
├── components/
│   ├── dashboard/          # Hero, Tasks, Emergency, Meds Summary, Appointment,
│   │                       # Restrictions, Hydration, Diet, Recovery Timeline
│   ├── medications/        # MedicationCard + countdown
│   ├── documents/          # SplitViewer + all empty/error/loading states
│   ├── nav/                # TopNav + ⌘K SearchPalette
│   ├── providers/          # SettingsProvider (theme/a11y context)
│   └── ui/                 # Card, Button, Badge, Accordion, Switch, Checkbox, etc.
└── lib/                    # data.ts (all mock data + types), document-data.ts, utils.ts
```

## Design System & Theming

The UI is styled with **CSS variables, not Tailwind color classes**. `src/app/globals.css` defines semantic tokens — `--color-*`, `--shadow-*`, and `--ease-*` — which Tailwind v4 references directly (e.g. `bg-(--color-blue)`).

Four accessibility modes are implemented via `data-*` attributes on `<html>`, driven by `SettingsProvider`:

| Setting | Values | DOM effect |
|---|---|---|
| Theme | `light` / `dark` / `system` | `data-theme="dark"` |
| Contrast | `normal` / `high` | `data-contrast="high"` |
| Text size | `normal` / `large` | `data-text-size="large"` |
| Motion | `system` / `reduced` | `data-motion="reduced"` |

Preferences are stored in `localStorage` under `aftercare:settings`. An inline script in the root layout applies them before hydration, so there's **no flash of the wrong theme**.

## Data Layer

Everything renders from a single source of truth, `src/lib/data.ts`:

- Typed interfaces: `Task`, `Medication`, `Appointment`, `TimelineEvent`, `FaqItem`, plus `foodsToEat`, `foodsToAvoid`, and `restrictions`.
- Medication `nextDoseAt` values are computed as `Date.now() + offset`, so countdowns always appear live.

Medical documents live in `src/lib/document-data.ts`.

## Roadmap

This is a work-in-progress prototype. A detailed, prioritized improvement plan — including real PDF ingestion, persistence, tests/CI, clinical-content consistency, and a catalog of 50+ planned features — lives in **[IMPROVEMENTS.md](./IMPROVEMENTS.md)**.

## Known Limitations

- **No persistence** — task/hydration/medication "taken" state resets on reload (settings are the only thing saved).
- **Mock data** — appointments and the recovery timeline are hardcoded to a fixed date range, not derived from a real surgery date.
- **Inert UI** — some controls (directions, Add to Calendar, refill buttons, notifications) render with no handler yet.
- **Unused dependencies** — `framer-motion`, `react-hook-form`, `zod`, and a few Radix packages are installed but not yet used (planned for real upload/forms).
