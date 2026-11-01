# PostHog production operations

PostHog is an optional, privacy-limited signal for the public portfolio. It is not an operational ledger. MongoDB and the payment provider remain authoritative for bookings, quotations, and payments.

## Event catalog

| Event | Source | Purpose | Allowed custom properties |
| --- | --- | --- | --- |
| `$pageview` | Browser | Public route traffic | Normalized `$pathname` / `route` |
| `$pageleave` | Browser | Anonymous visit duration | `$prev_pageview_duration` |
| `$autocapture` | Browser | Allowlisted public button/form interactions | Element tag/position and heatmap coordinates only |
| `$dead_click`, `$rageclick` | Browser | Public UX friction | SDK metadata only |
| `$exception` | Browser | Browser failures | Redacted exception fields |
| `$web_vitals` | Browser | LCP, CLS, FCP, and INP | PostHog web-vital fields |
| `$snapshot` / `$snapshot_item` | Browser | Session replay / vision on public routes | Recorder payload; inputs and payment iframes masked |
| `contact_submitted` | Browser | Successful contact submission | None |
| `booking_step_viewed` | Browser | Booking progression | `step`: `time`, `details`, or `checkout` |
| `booking_checkout_opened` | Browser | Checkout handoff | `correlation_id`, `payment_kind=booking`, `result=opened` |
| `booking_confirmed` | Browser | Browser-reported booking success | `correlation_id`, `payment_kind`, `result=confirmed` |
| `booking_payment_review` | Browser | Payment requiring review | `correlation_id`, `payment_kind`, `result=review` |
| `quotation_viewed` | Browser | Proposal opened | None |
| `quotation_accepted` | Browser | Proposal accepted | None |
| `quotation_milestone_reviewed` | Browser | Delivery milestone decision | `milestone_index`, `approved` |
| `quotation_payment_checkout_opened` | Browser | Proposal payment handoff | `milestone_index`, `correlation_id`, `payment_kind`, `result` |
| `quotation_payment_confirmed` | Browser | Browser-reported proposal payment | `milestone_index`, `correlation_id`, `payment_kind`, `result` |
| `quotation_payment_failed` | Browser | Proposal payment failed or could not open | `milestone_index`, `correlation_id`, `payment_kind`, `result` |
| `quotation_payment_dismissed` | Browser | Checkout dismissed by the visitor | `milestone_index`, `correlation_id`, `payment_kind`, `result` |
| `booking_order_created` / `booking_order_failed` | Backend | Checkout order creation | `correlation_id`, `event_source`, `outcome`, `payment_kind` |
| `booking_verification_confirmed` / `review` / `failed` | Backend | Authoritative verification | `correlation_id`, `event_source`, `outcome`, `payment_kind` |
| `booking_webhook_accepted` / `ignored` / `failed` / `rejected` | Backend | Webhook outcome | `correlation_id` when known, `event_source`, `outcome`, `payment_kind` |
| `booking_reconciliation_recovered` | Backend | Duplicate confirm recovered an already-captured payment | `correlation_id`, `event_source`, `outcome`, `payment_kind` |
| `quotation_order_created` / `quotation_order_failed` | Backend | Proposal checkout order creation | `correlation_id`, `event_source`, `outcome`, `payment_kind`, `milestone_index` |
| `quotation_verification_confirmed` / `failed` | Backend | Authoritative proposal verification | `correlation_id`, `event_source`, `outcome`, `payment_kind`, `milestone_index` |
| `quotation_webhook_accepted` / `ignored` / `failed` / `rejected` | Backend | Proposal webhook outcome | `correlation_id` when known, `event_source`, `outcome`, `payment_kind` |
| `quotation_reconciliation_recovered` | Backend | Duplicate confirm recovered an already-captured instalment | `correlation_id`, `event_source`, `outcome`, `payment_kind`, `milestone_index` |
| `receipt_delivery_succeeded` / `retry` / `exhausted` | Backend | Receipt email worker | `event_source`, `outcome` |
| `invitation_delivery_succeeded` / `retry` / `exhausted` | Backend | Invitation email worker | `event_source`, `outcome` |
| `api_error` | Backend | Express error boundary | `event_source`, `method`, `route` template, `status` |

Browser and backend payment events join only through the anonymous `correlation_id` UUID generated at checkout. Database IDs, gateway IDs, emails, amounts, and quotation contents are never analytics properties.

Not covered: `/admin` activity, person profiles, persistent identity, raw request bodies/headers, payment iframe contents, or events blocked by Do Not Track/content blockers. The frontend uses memory-only anonymous identity, so cross-visit users and retention are intentionally unreliable.

## Privacy and admin exclusion

- `/admin`, admin descendants, unknown private routes, query strings, and URL fragments are excluded. The SDK is not loaded on excluded routes, and `before_send` still drops `/admin` after a public pageview.
- Invitation tokens, names, email addresses, phone numbers, free text, raw identifiers, payment/order IDs, amounts, request bodies, and headers must never be analytics properties.
- A small notice links to /privacy with Accept / No thanks. Ignoring it or accepting keeps analytics on; declining (localStorage key `portfolio-analytics-consent` = `denied`) stops recording and all capture. `respect_dnt` is intentionally not set.
- Person profiles, persistent identity, IP enrichment, and surveys remain disabled. Public-route session replay, heatmaps, web vitals, network timing, error tracking, replay console logs, and first-party tracing headers are enabled. Inputs and Razorpay iframes are masked or excluded.
- Browser capture uses the first-party ingest host `https://v.pratyushes.dev` with `ui_host` `https://us.posthog.com`, so toolbar, replay, and heatmaps keep working while ad blockers are less likely to drop events.
- Text and element attributes are masked before autocapture. Exception URLs lose query strings and fragments, and email-like text is redacted.
- `node scripts/posthog/scan-analytics.mjs` rejects forbidden properties at direct SDK and backend `capture` calls. Feature code can only use the typed `AnalyticsService`; its `before_send` allowlist discards unapproved operational context. Tests, documentation, and sanitizer fixtures are intentionally outside the direct-emission scan.

## Credentials and scopes

Application runtime uses only the public project token:

- Frontend: `frontend/public/runtime/analytics.json` `projectToken`, `apiHost` (`https://v.pratyushes.dev`), and `uiHost` (`https://us.posthog.com`)
- Backend: `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`

Operational scripts use a personal API key supplied only at execution time:

- `POSTHOG_HOST`: app host, for example `https://us.posthog.com`
- `POSTHOG_PROJECT_ID`: numeric project ID
- `POSTHOG_CLI_API_KEY`: personal API key; never a browser `phc_` project token
- `POSTHOG_PROJECT_TOKEN`: public `phc_` token, used only by `--smoke` capture
- `POSTHOG_INGEST_HOST`: optional ingest host, default `https://us.i.posthog.com`

Use a dedicated automation key with the narrowest available read/write scopes: dashboard read/write, insight read/write, alert read/write, query read, error-tracking write, and organization read. The source-map CLI requires error-tracking write and organization read. GitHub stores `POSTHOG_PROJECT_ID`, `POSTHOG_CLI_API_KEY`, and `POSTHOG_HOST` as repository secrets. The public `phc_` project token remains only in runtime analytics configuration and the backend environment.

The personal key is passed only to the source-map upload action and API scripts. It is not a Docker build argument, build secret, copied file, image environment variable, or layer.

## Dashboard and alert bootstrap

From the repository root:

```bash
node scripts/posthog/bootstrap.mjs --dry-run --json
node scripts/posthog/bootstrap.mjs
```

The idempotent bootstrap creates or updates six managed dashboards: Executive, Booking Funnel, Quotation Payment Funnel, Reliability, Performance, and Delivery Operations. Insights use a stable managed name and are updated in place.

| Dashboard | What to inspect |
| --- | --- |
| Executive | Visitors, contact submissions, booking confirmations, quotation acceptance, payment confirmations, conversion rates |
| Booking Funnel | `/book` → details → checkout → checkout opened → confirmed / payment review |
| Quotation Payment Funnel | Proposal viewed → accepted → checkout opened → confirmed/failed/dismissed, segmented by milestone |
| Reliability | Browser exceptions, backend `api_error`, webhook failures/rejections, reconciliation recoveries |
| Performance | p75 LCP/INP/CLS/FCP by route and device, plus slow LCP counts |
| Delivery Operations | Receipt and invitation success, retries, and exhausted attempts |

Alerts exist for new browser/backend exceptions, payment verification failures, rejected or failed webhooks, reconciliation recoveries, receipt/invitation exhaustion, and Core Web Vitals LCP regressions (more than five slow LCP events). Isolated checkout dismissals and user cancellations do not alert.

Alert destinations are organization-specific; configure approved recipients in PostHog after the managed alert exists. The bootstrap preserves those destination records. API authorization, unsupported alert plans, and rejected alert schemas fail the run instead of silently leaving manual work.

## Production source maps

The Angular production configuration emits hidden script, style, and vendor source maps. On non-PR builds of `main` with `POSTHOG_CLI_API_KEY` set, the frontend deploy job:

1. builds `frontend/dist/frontend`;
2. injects PostHog chunk/release metadata into those exact bundles;
3. uploads supported maps with release `portfolio-frontend` and version equal to the Git SHA;
4. deletes all `.map` files;
5. builds the `runtime-prebuilt` nginx target from those already-injected assets.

PR builds perform the same production compilation without secrets, skip upload, delete maps, and build the runtime target. The Docker target fails if a map remains. The runtime image therefore serves the injected files while neither source maps nor the personal key enter the image.

## Deployment and ingestion verification

Set `DEPLOYMENT_URL` to the deployed public origin, then run:

```bash
node scripts/posthog/verify.mjs --dry-run --json
node scripts/posthog/verify.mjs --json
node scripts/posthog/verify.mjs --smoke --json
```

Verification checks the deployment, enabled public runtime token, JavaScript chunk metadata, absence of publicly served source-map JSON, all six dashboards, managed insights/alerts, and at least one allowlisted event ingested in the previous 24 hours. Set `POSTHOG_VERIFY_LOOKBACK_HOURS` from 1 to 720 when a low-traffic deployment needs a wider window. A capture HTTP 200 alone is not proof of ingestion; the script queries stored events.

`--smoke` sends tagged `$pageview`, `$exception`, `$web_vitals`, and payment-lifecycle events with `environment=test` and a unique `smoke_marker`, then confirms ingestion through the PostHog query API. Filter test traffic in dashboards with `environment = test` or `distinct_id = smoke:deployment`.

## Ownership and retention

The site owner owns dashboard meaning, privacy review, alert routing, and quarterly access review. The deployment owner owns source-map upload and smoke verification. Review managed dashboards and alert health monthly, remove stale automation keys immediately, and rotate the key at least annually. Configure the shortest PostHog event and error retention that supports operational diagnosis; do not increase retention to compensate for memory-only identity or use analytics as a customer record.

## Troubleshooting

- `401`/`403`: verify the personal key belongs to the project organization and has the listed scopes.
- Alert bootstrap `404`/`402` or schema rejection: confirm alerts are available on the PostHog deployment/plan and that `alert:write` is enabled. The script intentionally fails.
- Missing chunk metadata: confirm CI built the frontend before `PostHog/upload-source-maps@v2` and Docker used `target: runtime-prebuilt`.
- Public `.map` response: stop deployment; maps must be deleted before image assembly. An nginx SPA fallback returning `index.html` is not a source map and is accepted by verification.
- No recent ingestion: confirm `/runtime/analytics.json`, Do Not Track/blockers, project token/project ID pairing, public-route use, and the lookback window.
- Empty payment panels: payment events are conditional on payment configuration and real customer flows. Browser success is not authoritative; join with backend webhook events through `correlation_id`.
- Duplicate resources: managed resources are keyed by exact names. Restore the expected names, then rerun bootstrap; do not clone managed dashboards for automation.
