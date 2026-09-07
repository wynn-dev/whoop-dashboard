# FORM — personal WHOOP dashboard

A private dashboard built with TanStack Start, React, TypeScript, shadcn/ui,
and [Bklit UI charts](https://bklit.com/) (Visx and Motion). PostgreSQL stores
synced metrics and encrypted WHOOP tokens.

## Run locally

Requires Node.js 22.12+ and pnpm.

```sh
pnpm install
pnpm db:check
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3001` and choose **Connect your WHOOP**. Sign in on
WHOOP and grant access. The first sync imports 90 days. You can explore the
explicitly labeled demo before connecting; its data is never stored.

`db:migrate` runs `migrations/001_initial.sql` in a transaction. It creates
only the `whoop_dashboard` schema and its `connections`, `sessions`,
`records`, and `migrations` tables. Your PostgreSQL role needs permission to
create this schema. Existing application tables are not modified.

The dev server listens on `localhost:3001`. If you change the port, update
the `dev` script, both URL settings below, and the WHOOP callback registration.
Use the configured `APP_URL` for OAuth so the state cookie returns to the
same hostname.

## Environment setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, and `WHOOP_ALLOWED_EMAIL`
   using your app credentials and your WHOOP account email.
3. Run `openssl rand -hex 32` twice. Use one result for `SESSION_SECRET` and
   the other for `TOKEN_ENCRYPTION_KEY`.
4. Register `http://localhost:3001/api/auth/whoop/callback` as a redirect URI
   in the WHOOP Developer Dashboard. If using an HTTPS tunnel, set `APP_URL`
   to the tunnel origin and `WHOOP_REDIRECT_URI` to that origin followed by
   `/api/auth/whoop/callback`, and register that exact URI instead.
5. Enable the six `read:...` scopes listed in `.env.example` in your WHOOP app.
   Leave `offline` in `WHOOP_SCOPES`; it is requested during OAuth to obtain
   a refresh token.
6. Set `DATABASE_URL` to your PostgreSQL connection string. The example uses
   a local `whoop_dashboard` database on port 5432; replace the credentials
   or use your hosted provider's connection string, including its TLS options.
   The database must exist before running the application.

`.env.local` is excluded by `.gitignore`. All configuration in the template
is server-only. The Connect WHOOP flow obtains and refreshes tokens; you do
not need to paste an access token into the environment file.

## Features and data behavior

- Overview, Health Monitor, recovery, sleep, and activity views; 7-, 30-, and
  90-day trends ending on the selected day, including historical days.
- The selected physiological day is the page heading. Step days with the
  arrows, the left/right keyboard keys, or the day picker; **Latest** jumps
  back to the newest day.
- Insights computed only from your own days: a week-in-review against the
  week before, the recovery mix of a period, average recovery grouped by the
  previous night's sleep and the previous day's strain, a sleep-timing chart
  with bedtime and wake spread and a 7-night balance against need, 7-day vs
  28-day training load, and a by-sport breakdown. All descriptive, never
  prescriptive.
- Day tiles for recovery, strain, and sleep; signals compared with your own
  range average; a last-night panel with bedtime, sleep need, and stages;
  sleep-stage and HRV/RHR trends; workout details; and an accessible
  daily-values table. Responsive layout with a bottom tab bar on phones, and
  reduced-motion support.
- Health Monitor brings HRV, resting heart rate, respiratory rate, blood
  oxygen, and skin temperature together. Each metric has a selectable chart,
  exact readings table, explicit missing/calibration states, and a personal
  comparison. Temperature includes its change from the FORM median.
- Sleep detail includes WHOOP's baseline need, debt, strain adjustment and
  signed nap credit; time in bed/awake, disturbances, sleep-cycle counts,
  recording gaps, and separately listed naps with their stage totals.
- Activity detail includes selected-day sessions, daily average/maximum heart
  rate, six workout heart-rate zones, recording coverage, and elevation where
  WHOOP supplies it. Longer activity lists expand in batches of six.
- The main sleep's wake-up date and recorded timezone determine a cycle's
  display date. Pending/missing scores remain absent, not zero. Naps are
  excluded from the nightly breakdown. Energy is converted from kJ to kcal.
- Auto-sync on opening when cached data is older than 15 minutes, then about
  every 15 minutes while the dashboard remains open. **Sync now** refreshes
  manually. Syncs reconcile the last 90 days, including edited/deleted records.
- Historical data stays available if WHOOP is temporarily unavailable.
  Expired/revoked connections show a reconnect action. Closed-browser
  background sync and WHOOP webhooks are not configured.

### Health comparisons: readings versus interpretation

WHOOP supplies the measurements. **FORM calculates its own comparisons**;
these are not WHOOP Health Monitor's official ranges or alerts.

For each metric and date, FORM uses the preceding 30 calendar days, excluding
the selected day and future dates. At least 14 distinct valid days are needed.
Missing values and WHOOP-calibrating recovery readings are excluded; respiratory
rate comes from sleep and is evaluated independently. If multiple physiological
cycles share a local date, the final value for that date is used once.

The center is the median; the observed range is the interpolated 10th–90th
percentile (the middle 80% of prior readings). Labels describe above/below/within
this range, not healthy/unhealthy or better/worse. They are not medical alerts
or diagnoses. Changing the visible 7/30/90-day period does not change the
30-day comparison window. Earlier imported dates may lack sufficient history.

Health charts use labelled, auto-scaled axes and retain missing-day gaps.
Shading shows each date's rolling FORM range; the dashed line is its median.
Raw readings, including calibration readings, remain visible. These are
summary measurements: the public API does not expose continuous heart-rate
traces, detailed overnight sensor streams, or WHOOP's official baseline ranges.
See the [WHOOP API schema](https://api.prod.whoop.com/developer/doc/openapi.json)
and [continuous-heart-rate FAQ](https://developer.whoop.com/docs/developing/support/).

All additional sleep/workout fields are read from the existing stored JSON
records. No new database migration, scopes, or external integration is required.
Optional fields display a dash when unavailable; a real zero remains zero.

## Authentication and storage

WHOOP OAuth uses authorization-code flow with `offline`, a random state
bound to an encrypted HttpOnly cookie, and an email allowlist. Dashboard
sessions last 30 days, are encrypted with `SESSION_SECRET`, and are backed
by hashed tokens in PostgreSQL. Signing out invalidates the current session;
it keeps your connection and synced data so you can return later.

Access and refresh tokens are encrypted with AES-256-GCM. A PostgreSQL row
lock serializes refresh-token rotation across concurrent requests. Keep
`TOKEN_ENCRYPTION_KEY` stable; rotating it requires reconnecting WHOOP.
All private API responses use `Cache-Control: private, no-store`; mutations
validate the request Origin. Configure HTTPS in production for secure cookies.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Browser tests cover the demo UI on desktop/mobile, date/range navigation,
chart layout and gaps, baseline stability, missing/calibration states, nap and
workout details, pagination, OAuth state/scopes, and unauthorized requests.
They do not log into WHOOP or write to your database. Generated screenshots
are placed in ignored `artifacts/`. Unit tests cover token encryption,
metric/date calculations, baseline sample eligibility, historical windows,
signed nap credits, and partial heart-rate zone data.

The chart components were installed from Bklit's shadcn registry. Local fixes
correct its generated import/CSS paths and stacked bar y-domain calculation.
Visx alpha packages are bundled for SSR to resolve their extensionless ESM
imports; preserve the `ssr.noExternal` setting when updating dependencies.

## Production

```sh
pnpm build
pnpm start
```

The Nitro Node server runs from `.output/server/index.mjs`. Supply the same
server environment variables through your host; `start` also supports a
local `.env.local`. Set `APP_URL` and `WHOOP_REDIRECT_URI` to your HTTPS domain
and register the callback in WHOOP. Run the migration once before connecting.
The hosting platform must allow sync requests to run for several minutes;
this implementation targets a persistent Node server, not short-lived
serverless functions. No deployment has been performed.

API setup: [WHOOP getting started](https://developer.whoop.com/docs/developing/getting-started/)
and [OAuth guide](https://developer.whoop.com/docs/developing/oauth/).
