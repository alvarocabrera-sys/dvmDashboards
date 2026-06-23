# DVM Dashboards

Rebuild of the DVM Metrics Dashboard using an iFrame analytics surface with preserved top-level filters.

## What is implemented

- Host dashboard page with:
  - DVM user dropdown (blank = aggregate)
  - Date range filters (single day or custom range)
- Embedded iFrame analytics page with:
  - Core metrics cards
  - Service type breakdown (excluding Virtual Locum and Testing)
  - Task statistics
  - Consults-per-hour line graph
  - Top 10 DVM leaderboard
  - Additional stats (PPH add-ons, cancellations by reason, time-between-consults)
- Backend API under `/api/dvm-dashboard/*` implementing all TDD endpoints.
- Role-aware query guardrails (`x-dashboard-role`, `x-dashboard-user-id`).
- Signed iFrame token endpoint (`/api/dvm-dashboard/iframe/signed-url`).

## Finalized metric defaults

- **Consultations Per Hour (CPH):** calendar-time denominator based on selected date range.
- **Available Consultations:** assigned/available and not yet claimed in the selected range.
- **Service exclusions:** `Virtual Locum`, `Testing`.
- **Time-between-consults:** consults in `Assigned` or `Claimed` status only.
- **PPH add-ons:** aggregate only (never user segmented).

## API endpoints

- `GET /api/dvm-dashboard/filters/users`
- `GET /api/dvm-dashboard/summary`
- `GET /api/dvm-dashboard/service-breakdown`
- `GET /api/dvm-dashboard/task-stats`
- `GET /api/dvm-dashboard/cancellations`
- `GET /api/dvm-dashboard/pph-addons`
- `GET /api/dvm-dashboard/time-between-consults`
- `GET /api/dvm-dashboard/graphs/consults-per-hour`
- `GET /api/dvm-dashboard/leaderboard/top-dvms`
- `GET /api/dvm-dashboard/iframe/signed-url`

## Local development

```bash
npm install
npm run dev
```

- Vite app: `http://127.0.0.1:5173`
- API server: `http://127.0.0.1:3001`

If `DATABASE_URL` is not provided, API endpoints return deterministic mock data so the UI remains testable.
