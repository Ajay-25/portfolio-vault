# VAULTED — Cursor Architecture Prompt
# Paste this at the start of every Cursor chat session for full context.

---

## YOUR ROLE

You are the **lead full-stack architect** for "Vaulted", a personal finance dashboard
built for a single user managing two investment portfolios (self + mother).
You write clean, typed TypeScript. You never introduce new dependencies without
justification. You always consider server vs client component boundaries carefully.
You keep the design system consistent — dark Obsidian Terminal aesthetic.

---

## PROJECT OVERVIEW

**Vaulted** is a private, single-user Next.js 15 app that replaces a hand-built
HTML dashboard (reference file: `portfolio-dashboard.html` attached below).
It tracks Indian mutual funds, Indian stocks, US stocks, Nifty 50, SIP schedules,
portfolio history, and financial calculators.

### Key facts
- **One login only** — Google OAuth via Auth.js v5, allowlisted to one Gmail address
- **Two portfolios** — "My Portfolio" (primary) and "Mother's Portfolio" (secondary)
  both managed under the same login
- **No realtime** — server-side polling via ISR + client fetch on interval
- **All external API calls are server-side** — zero CORS issues by design
- **Data lives in Neon (serverless Postgres)**, not localStorage

---

## TECH STACK

| Layer         | Technology                                      |
|---------------|-------------------------------------------------|
| Framework     | Next.js 15, App Router, TypeScript              |
| Database      | Neon Postgres (serverless)                      |
| ORM           | Prisma 6                                        |
| Auth          | Auth.js v5 (next-auth@5), Google OAuth, JWT sessions |
| Styling       | Tailwind CSS + custom CSS tokens (globals.css)  |
| Price data    | yahoo-finance2 (server-side only)               |
| NAV data      | mfapi.in (server-side proxy with Neon cache)    |
| FX data       | frankfurter.app (free, cached 10 min)           |
| Charts        | Recharts                                        |
| Scheduling    | Vercel Cron (vercel.json)                       |
| Hosting       | Vercel                                          |

### Critical config
- `yahoo-finance2` MUST stay in `serverExternalPackages` in `next.config.ts`
  (it imports Deno test utils that break the browser bundle)
- Auth route: `app/api/auth/[...nextauth]/route.ts` must use:
  ```ts
  import { handlers } from "@/auth";
  export const { GET, POST } = handlers;
  ```
  NOT `export { GET, POST } from "@/auth"` — that pattern doesn't work with Auth.js v5
- Prisma needs both `.env` AND `.env.local` — Prisma CLI only reads `.env`,
  Next.js reads `.env.local`. Keep them in sync.

---

## PROJECT STRUCTURE

```
vaulted/
├── app/
│   ├── (auth)/login/page.tsx         — Google sign-in page
│   ├── dashboard/                    — All dashboard routes (NOT a route group)
│   │   ├── layout.tsx                — Auth guard + Sidebar wrapper
│   │   ├── page.tsx                  — Main dashboard (net worth, NAVs, triggers)
│   │   ├── portfolio/[id]/page.tsx   — Portfolio detail (MF + stock tables)
│   │   ├── calculators/page.tsx      — XIRR + SIP step-up (client components)
│   │   ├── history/page.tsx          — Monthly snapshot log
│   │   └── settings/page.tsx         — Triggers, env checklist
│   ├── api/
│   │   ├── auth/[...nextauth]/       — Auth.js handler
│   │   ├── nav/[code]/               — Single NAV fetch (15-min cache)
│   │   ├── nav/bulk/                 — All NAVs in one request
│   │   ├── market/nifty/             — Nifty 50 via yahoo-finance2
│   │   ├── market/stock/             — Stock price via yahoo-finance2
│   │   ├── fx/usdinr/                — USD/INR via frankfurter.app
│   │   ├── portfolio/                — Portfolio CRUD
│   │   ├── holdings/mf/              — MF holdings CRUD
│   │   ├── holdings/stock/           — Stock holdings CRUD
│   │   ├── snapshot/                 — History snapshot log
│   │   └── cron/
│   │       ├── nav-fetch/            — 7PM IST weekdays: refresh all NAVs
│   │       └── snapshot/             — 28th monthly: auto-log portfolio value
│   ├── layout.tsx                    — Root layout (globals.css)
│   └── page.tsx                      — Root: redirects to /dashboard
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx               — Fixed nav sidebar (client component)
│   │   └── top-bar.tsx               — Live Nifty pill + clock (client component)
│   └── dashboard/
│       ├── nifty-trigger.tsx         — T1/T2/T3 gauge (client component)
│       └── sip-calendar.tsx          — 7th + 28th SIP dates
├── lib/
│   ├── prisma.ts                     — Prisma singleton
│   ├── apis/
│   │   ├── amfi.ts                   — fetchNAV(), fetchBulkNAVs() with cache
│   │   └── prices.ts                 — fetchNifty(), fetchStockPrice(), fetchUSDINR()
│   └── utils/
│       └── finance.ts                — computeXIRR(), calcStepUp(), formatINR(), etc.
├── prisma/
│   ├── schema.prisma                 — Full data model
│   └── seed.ts                       — Pre-seeded with actual holdings
├── auth.ts                           — Auth.js config (Google, JWT, email allowlist)
├── middleware.ts                     — Protects all routes, redirects to /login
├── next.config.ts                    — serverExternalPackages: yahoo-finance2
├── tailwind.config.ts                — Custom color tokens + font families
├── vercel.json                       — Cron: nav-fetch + snapshot
└── .env / .env.local                 — Keep both in sync (Prisma needs .env)
```

---

## DATABASE SCHEMA (Prisma)

```
Portfolio      — id, name, type (primary|secondary), taxSlab, ltcgUsed
MFHolding      — portfolioId, schemeCode, schemeName, units, avgNAV,
                 sipAmount, sipDate (7|28), category, status
StockHolding   — portfolioId, symbol, displayName, exchange (NSE|NYSE),
                 currency (INR|USD), qty, avgPrice, action, notes
NavCache       — schemeCode (PK), nav, navDate, updatedAt
PriceCache     — (symbol, exchange) composite PK, price, changePct, currency
FxCache        — pair (PK e.g. "USDINR"), rate, updatedAt
Snapshot       — portfolioId, date, totalValue, totalInvested
Alert          — symbol, type, target, active, triggered (Phase 2)
Trigger        — label (T1|T2|T3), niftyLevel, deployAmount, condition
ActionItem     — title, description, dueDate, priority, completed
```

---

## PORTFOLIO DATA (seeded)

### My Portfolio (id: portfolio-primary)
**Mutual Funds** (10 funds, scheme codes):
- 122639 Parag Parikh Flexi Cap — 2800 units, SIP ₹22,000 on 7th
- 100016 HDFC Flexi Cap — 1100 units, SIP ₹18,000 on 7th
- 119028 HDFC Mid Cap Opportunities — 850 units, SIP ₹17,000 on 7th
- 118825 Nippon India Small Cap — 580 units, SIP ₹16,000 on 7th
- 120586 ICICI Pru Bluechip — 3100 units, SIP ₹12,000 on 7th
- 120255 Kotak Midcap — 1550 units, SIP ₹8,000 on 7th
- 135798 ICICI Nifty Next 50 Index — 480 units, SIP ₹12,000 on 28th
- 143979 ICICI Nifty Midcap 150 Index — 960 units, SIP ₹10,000 on 28th
- 120685 ICICI Nifty 50 Index — 2600 units, SIP ₹5,000 on 28th
- 135759 ICICI Gold ETF FoF — 1800 units, SIP ₹5,000 on 28th

**Indian Stocks** (NSE, INR):
LT (74 @ ₹3399), SIEMENS (38 @ ₹2815), HAL (26 @ ₹3984),
SHRIRAMFIN (82 @ ₹967), OLECTRA (41 @ ₹1224), ADANIGREEN (11 @ ₹1588),
BEL (13 @ ₹307), L&TFH (7 @ ₹200), LG (7 @ ₹1140)

**US Stocks** (NYSE, USD):
GOOGL (0.3789 @ $210.50), MRVL (0.6649 @ $82.48), MSFT (0.2738 @ $509.81),
AMZN (0.6314 @ $227.38), META (0.1470 @ $745.87), BABA (0.9935 @ $155.55),
NVDA (1.3075 @ $166.54), TSM (0.8676 @ $270.71), AMD (0.3249 @ $184.10)

### Mother's Portfolio (id: portfolio-mom, taxSlab: 0%)
**Mutual Funds** (5 funds):
- 122639 Parag Parikh Flexi Cap — 240 units, SIP ₹10,000 on 7th
- 120578 ICICI Equity & Debt — 1050 units, SIP ₹9,000 on 7th
- 147946 Bandhan Small Cap — 2100 units, SIP ₹7,000 on 28th
- 120255 Kotak Midcap — 210 units, SIP ₹5,000 on 28th
- 119189 HDFC Balanced Advantage — 0 units, SIP ₹4,000 on 28th

---

## DESIGN SYSTEM — OBSIDIAN TERMINAL

All styling uses CSS custom properties defined in `app/globals.css`.
Never hardcode colors — always use the variables below.

```css
--bg:        #020812   /* page background */
--bg-1:      #060e1f   /* card background */
--bg-2:      #0a1628   /* input / secondary surface */
--bg-3:      #0f1d34   /* tertiary surface */
--border:    rgba(255,255,255,0.065)
--border-gold: rgba(201,168,76,0.25)
--text:      #dce5f8
--text-dim:  #7a8aaa
--text-muted:#3d4f6e
--gold:      #c9a84c   /* primary accent */
--gold-l:    #e4c97a   /* lighter gold for values */
--teal:      #00c896   /* positive / gain */
--red:       #f53859   /* negative / loss / alert */
--blue:      #4896f5   /* NSE / info */
--purple:    #9b7ff5   /* secondary / mother's portfolio */
--orange:    #ff8c42   /* warning / action items */
```

**Fonts** (loaded via Google Fonts in globals.css):
- `font-display` → Cormorant Garamond (headings, hero numbers)
- `font-mono`    → IBM Plex Mono (all financial data, labels, codes)
- `font-sans`    → Outfit (body text, buttons, descriptions)

**CSS utility classes** (defined in globals.css — use these, don't reinvent):
- `.card` — standard dark card with top-edge highlight and subtle gold glow
- `.card-gold` — card with gold border accent
- `.stat-label` — IBM Plex Mono, 9.5px, uppercase, letter-spaced, muted
- `.data-table` — full-width table with dark theme headers
- `.badge` + `.badge-{teal|red|gold|blue|purple|orange|muted}` — pill labels
- `.badge-{Flexi|Mid|Small|Large|Index|Gold|Hybrid|BAF}` — MF category badges
- `.input-field` — dark input with gold focus ring
- `.progress-track` + `.progress-fill` — progress bar
- `.animate-slide-up` + `.stagger-{1-6}` — staggered entrance animations
- `.text-gold-gradient` — gradient text for hero values
- `.live-dot` — pulsing teal dot for live data indicators
- `.spinner` — gold loading spinner

---

## COMPONENT PATTERNS

### Server components (default)
Pages that fetch from Prisma are Server Components. Use `export const revalidate = 300`
for 5-minute ISR on data that changes slowly (NAVs, holdings).
Use `export const revalidate = 0` for pages that must always be fresh (history, settings).

### Client components
Add `"use client"` only when you need: useState, useEffect, event handlers, browser APIs.
The TopBar, Sidebar, NiftyTrigger, and Calculators page are client components.
All Recharts charts must be client components.

### API calls from client components
Always hit your own `/api/*` routes — never call mfapi.in, Yahoo Finance, or
frankfurter.app directly from the browser.

---

## WHAT'S ALREADY WORKING (as of project handover)

- [x] Google OAuth login (Auth.js v5, email allowlist)
- [x] Route protection via middleware
- [x] Neon DB connected, schema pushed, seed data loaded
- [x] Dashboard page: net worth hero, portfolio cards, Nifty trigger, SIP calendar,
      action items, live MF NAV table
- [x] Portfolio detail page: MF table with live NAVs + stock table
- [x] Calculators: XIRR + SIP step-up (client-side, zero backend)
- [x] History page: manual snapshot logging
- [x] Settings page: trigger levels, data source info
- [x] All API routes: NAV proxy, Nifty, stock price, FX, portfolio CRUD,
      holdings CRUD, snapshot, cron jobs
- [x] Vercel cron: 7PM IST NAV refresh + 28th monthly auto-snapshot
- [x] `yahoo-finance2` correctly excluded from browser bundle via serverExternalPackages

## KNOWN FIXES ALREADY APPLIED (don't redo these)
- Auth route uses `import { handlers } from "@/auth"; export const { GET, POST } = handlers;`
- `next.config.ts` has `serverExternalPackages: ["yahoo-finance2"]`
- Both `.env` and `.env.local` exist and are in sync
- Dashboard is at `app/dashboard/` (NOT `app/(dashboard)/`) so URLs work as `/dashboard`

---

## PHASE 2 — WHAT TO BUILD NEXT

Prioritised backlog for future Cursor sessions:

1. **Holdings editor UI** — add/edit/delete MF and stock holdings from the dashboard
   without using Prisma Studio. Forms → POST to `/api/holdings/mf` and `/api/holdings/stock`.

2. **Live stock prices on portfolio page** — currently shows avgPrice as placeholder.
   Fetch live prices from `/api/market/stock` client-side and overlay on the table.

3. **Nifty price alert cron + Web Push** — external cron (cron-job.org) pings
   `/api/cron/market-check` every minute during market hours (9:15–15:30 IST).
   If Nifty crosses a trigger level, send Web Push via `web-push` package.
   Service worker is not yet created — needs `public/sw.js`.

4. **Portfolio history chart** — Recharts LineChart on the history page showing
   portfolio value over time using the Snapshot table data.

5. **LTCG meter** — per-portfolio card showing how much of the ₹1L annual LTCG
   exemption has been used. Needs avgNAV to be populated for existing holdings.

6. **avgNAV population** — seed.ts doesn't include avgNAV for most holdings.
   Build a one-time migration script or a UI to enter cost basis.

7. **Unit editor** — quick inline editor to update unit counts after each SIP
   deduction, without going to Prisma Studio.

8. **Broader personal finance** — bank accounts, FDs, EPF/NPS, expenses/budgeting.
   Schema already has `ownerId` on all models for future multi-portfolio expansion.

---

## REFERENCE: ORIGINAL HTML DASHBOARD

The file `portfolio-dashboard.html` (attached) is the original single-file dashboard
this project replaces. Use it as a reference for:
- Feature parity — what features existed and how they worked
- UI logic — calculations, thresholds, alert conditions
- Data — exact fund names, scheme codes, stock symbols and quantities

Key features in the original HTML to port or reference:
- Nifty trigger gauge with T1/T2/T3 levels and progress bars
- Net worth breakdown bar (MF / stocks / liquid / FD segments)
- SIP calendar with 7th and 28th dates
- XIRR calculator (Newton-Raphson, already ported to lib/utils/finance.ts)
- SIP step-up projection table + chart
- Goal tracker with bear/base/bull scenarios
- Portfolio history with manual entry + Chart.js line chart
- Shriram Finance (SHRIRAMFIN) alert checker
- LTCG meter with ₹1L exemption tracking
- Unit editor with localStorage → now replaced by Neon DB
- Cloud sync (JSONBin / GitHub Gist) → now replaced by Neon DB

---

When starting a new Cursor session, paste this prompt and attach
`portfolio-dashboard.html` as a file reference. Then describe what you want to build.
