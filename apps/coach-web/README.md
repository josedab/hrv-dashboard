# HRV Coach (Web)

Coach-facing web dashboard. Loads a backup file from a single athlete (or
a multi-athlete bundle), runs it through the **same** HRV engine the
mobile app uses (`../../src`), and renders streak / baseline / verdict
columns.

> Status: **skeleton**. Drop-in for `.json` exports today; `.hrvbak`
> (encrypted) decoding lands once the cipher is ported to WASM.

## Run locally

```bash
cd apps/coach-web
npm install
npm run dev
# open http://localhost:3001
```

## Architecture

```
apps/coach-web/
├── app/
│   ├── layout.tsx     # Root HTML + theme
│   └── page.tsx       # File picker + table
└── lib/
    └── loadBackup.ts  # Adapter → buildDashboardSummary()
```

The Next.js `transpilePackages` + `paths` aliases let us import the
shared engine directly:

```ts
import { buildDashboardSummary } from '@hrv/web/dashboard';
```

`react-native`, `expo-sqlite`, and `expo-crypto` are stubbed in
`next.config.js` so the engine pulls without bundling RN.

## Roadmap

1. **WASM cipher** — port `src/sync/crypto.ts` to a tiny WASM blob; let
   the dashboard accept real `.hrvbak` files end-to-end.
2. **Multi-athlete view** — sort/filter, day-grain heat-map per athlete.
3. **Coach notes** — write notes back to the bundle (re-export `.hrvbak`).
4. **Auth (optional)** — Supabase magic link if hosting a shared instance.
