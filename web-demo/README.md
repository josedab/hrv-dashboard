# Web demo

Single-file static demo of the HRV dashboard. Open
[`index.html`](index.html) directly in a browser, or serve the folder
with any static file server:

```bash
npx serve web-demo
```

The demo uses generated sample data so anyone can preview the UI
without a paired chest strap. In production this becomes a Next.js
route that pulls real data via the cloud-sync providers
(`src/sync/cloudProviders.ts`) and renders through the typed adapters
in `src/web/dashboard.ts`:

- `buildDashboardSummary(sessions)` — KPI cards
- `buildTrendSeries(sessions, days)` — sparkline / trend chart
- `buildPdfReportData(sessions)` + `renderReportHtml(report)` — printable export

The static HTML mirrors that data shape so the eventual Next.js port is
a straight swap of the inline `sessions` array for an authenticated
fetch.
