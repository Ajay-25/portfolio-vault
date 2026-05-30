# Vaulted — Portfolio Command Centre

A personal finance dashboard for managing mutual funds, stocks, and net worth.
Built with Next.js 15 + Neon (Postgres) + Auth.js v5 + Prisma.

---

## Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Next.js 15 (App Router, TypeScript) |
| Database    | Neon Postgres (serverless)          |
| ORM         | Prisma                              |
| Auth        | Auth.js v5 (Google OAuth)           |
| Styling     | Tailwind CSS + custom CSS tokens    |
| Charts      | Recharts                            |
| Price Data  | yahoo-finance2 (server-side)        |
| NAV Data    | mfapi.in (server-side proxy)        |
| FX Data     | frankfurter.app                     |
| Hosting     | Vercel + Vercel Cron                |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.local.example .env.local
# Fill in all values — see comments in the file
```

### 3. Set up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID + Secret → `.env.local`

### 4. Set up Neon database
1. Create a project at [neon.tech](https://neon.tech)
2. Copy the **pooled** connection string → `DATABASE_URL`
3. Copy the **direct** connection string → `DIRECT_URL`

### 5. Push schema + seed data
```bash
npm run db:push    # pushes schema to Neon
npm run db:seed    # seeds your portfolios, funds & stocks
```

### 6. Run locally
```bash
npm run dev
# → http://localhost:3000
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Add all env vars in Vercel dashboard
4. Add `NEXTAUTH_URL=https://yourdomain.vercel.app`
5. Update Google OAuth redirect URI to production URL
6. Deploy

Cron jobs in `vercel.json` run automatically on Vercel:
- **7PM IST (Mon–Fri)**: Fetch fresh NAVs → update cache
- **28th monthly**: Auto-snapshot all portfolios

> **Note**: Cron jobs every minute require Vercel Pro. For the hobby plan,
> use an external scheduler like [cron-job.org](https://cron-job.org) to hit
> `/api/cron/nav-fetch` with `Authorization: Bearer YOUR_CRON_SECRET`.

---

## Project Structure

```
vault/
├── app/
│   ├── (auth)/login/           — Login page
│   ├── (dashboard)/            — All dashboard pages
│   │   ├── page.tsx            — Main dashboard (net worth, live NAVs)
│   │   ├── portfolio/[id]/     — Portfolio detail (MF + stock tables)
│   │   ├── calculators/        — XIRR + SIP step-up calculator
│   │   ├── history/            — Monthly snapshot history
│   │   └── settings/           — Triggers + data source config
│   └── api/
│       ├── auth/               — Auth.js handler
│       ├── nav/                — AMFI NAV proxy + bulk fetch
│       ├── market/             — Nifty, stock prices
│       ├── fx/                 — USD/INR
│       ├── portfolio/          — Portfolio CRUD
│       ├── holdings/           — MF + stock CRUD
│       ├── snapshot/           — History logging
│       └── cron/               — Scheduled jobs
├── components/
│   ├── layout/                 — Sidebar, TopBar
│   └── dashboard/              — NiftyTrigger, SIPCalendar
├── lib/
│   ├── apis/                   — amfi.ts, prices.ts
│   └── utils/                  — finance.ts (XIRR, step-up, formatINR)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                 — Pre-loaded with your holdings
├── auth.ts                     — Auth.js config
├── middleware.ts               — Route protection
└── vercel.json                 — Cron schedule
```

---

## Updating Holdings

### Units / SIP amounts
Edit `prisma/seed.ts` → re-run `npm run db:seed`.
Or use the Prisma Studio GUI: `npm run db:studio`.

### Adding new funds/stocks
Use the CRUD APIs directly (`/api/holdings/mf`, `/api/holdings/stock`)
or add a management UI (Phase 2 feature).

---

## Phase 2 Roadmap
- [ ] Holdings editor UI (add/edit/delete from dashboard)
- [ ] Nifty price alert cron + Web Push notifications
- [ ] LTCG meter per portfolio
- [ ] Bank accounts + expenses (broader personal finance)
- [ ] PWA / mobile app experience
- [ ] Portfolio comparison charts (Recharts)
