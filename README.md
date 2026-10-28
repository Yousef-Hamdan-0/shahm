# شهم | SHAHM — Interactive Prototype

Arabic-first (RTL) last-mile delivery operations demo: Admin, Merchant, and Captain interfaces sharing one client-side state.

```bash
npm install
npm run dev              # http://localhost:5173
npm run build            # static build in dist/ (SPA fallback: public/_redirects)
npm run test:scenarios   # headless checks of demo scenarios A–D and wallet rules
```

## Demo accounts
Quick-access buttons on `/login`, or credentials: `admin / admin1234`, `merchant1..6 / demo1234`, `captaina..h / demo1234`.

Seeded wallet cases: Captain A = 0 JOD, B = 1 JOD, C = 5 JOD, D = 10 JOD (D holds a private offer).

## Presenter tools
The dashed **أدوات العرض** button (bottom-left) switches roles/captains, simulates GPS updates and loss, toggles broadcasting, launches scenarios A–D with step guides, and resets data.

## Where the logic lives
- `src/lib/rules.ts` — order state machine, wallet ledger maths, eligibility
- `src/store/useStore.ts` — every state transition (Zustand + localStorage)
- `src/lib/seed.ts` — deterministic seed data (Amman)

## Honest limitations
- State lives in this browser's localStorage. Tabs in the same browser sync; separate devices do not. A cross-device demo would need a shared backend with realtime updates.
- Order acceptance is a synchronous in-memory check, not server-side transactional locking.
- Captain locations are simulated unless a captain explicitly enables device location in Profile. Amounts are stored as integer fils, and recharges are demo balances, not real money transfers.
