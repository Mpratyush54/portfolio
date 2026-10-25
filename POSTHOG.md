# PostHog analytics and responsive navigation

The public project token supplied by the site owner is configured for US Cloud. It is a browser project token, not a personal/admin API key. Never place a personal API key in these files.

## Runtime configuration

- Development/static builds read `frontend/public/runtime/analytics.json` through `/runtime/analytics.json`.
- Kubernetes reads the same JSON shape from `kubernetes/analytics-config.yaml` (`portfolio-analytics` ConfigMap). The frontend mounts the whole ConfigMap directory at `/usr/share/nginx/html/browser/runtime`; it deliberately does not use a `subPath` mount.
- Nginx serves runtime configuration with `Cache-Control: no-store`. Change `enabled`, `projectToken` or `apiHost` in the tracked ConfigMap and let Argo sync it. Kubernetes propagates the mounted ConfigMap update; new page loads pick it up without rebuilding images or restarting/deleting a server. An already open tab keeps its initial configuration until refreshed.
- Setting `enabled` to `false` disables SDK loading on the next page load. A missing, malformed, insecure-host or timed-out configuration also leaves optional analytics disabled; booking/navigation still work.
- Normal source changes still require the PRs to merge and the image build/Argo rollout to complete. This work has not been deployed to production.

Integration uses the [PostHog Angular SDK guide](https://posthog.com/docs/libraries/angular) and [JavaScript configuration reference](https://posthog.com/docs/libraries/js/config), with `posthog-js` 1.438.21 loaded dynamically after a public route and valid configuration are available.

## Recorded events

| Event | Additional custom properties |
| --- | --- |
| `$pageview` | Normalised public route only |
| `booking_step_viewed` | `step`: `time`, `details`, `checkout` |
| `booking_checkout_opened` | None |
| `booking_confirmed` | None |
| `booking_payment_review` | None |
| `contact_submitted` | None |

Public routes are Home, Work/Projects, About, Contact, Book and the not-found page. Public project-detail IDs are replaced with `/projects/:id`. Query strings and URL fragments are removed. Admin, proposal and unknown/private routes are not tracked. Landing directly on admin or a private proposal does not request runtime analytics configuration or load the SDK.

Automatic page/leave capture, form/click autocapture, session replay, heatmaps, error/performance capture, surveys, feature-flag requests and external extension loading are disabled. A `before_send` allowlist drops unrecognised events and strips all properties except anonymous SDK identity/device metadata, the public project token, normalised route and the enumerated booking step. Top-level person `$set`/`$set_once` properties are also removed. No names, emails, phone numbers, message text, quotation content, invite tokens, order/payment IDs, dates, slot values or prices are included.

The SDK respects Do Not Track, disables IP enrichment, never creates person profiles and uses memory-only identity with persistence disabled. Consequently a reload starts a new anonymous identity; this configuration does not provide reliable cross-visit unique-person or retention counts. Client-side funnel events can be blocked or lost and are not a payment ledger. Real booking/payment status remains in MongoDB and Razorpay. The SDK's normal bot filtering stays enabled.

## Responsive regression

The reported 1499×543 touch-emulated desktop activated `(pointer: coarse)` rules that displayed phone navigation, while its dark styles and fixed positioning only existed below 640px. Layout now uses the shared **900px viewport-width breakpoint**. Pointer capability separately controls custom-cursor eligibility. Every compact width gets complete navigation styling and fixed positioning; wide touch screens keep desktop navigation. Reactive media-query signals update the contact form, cursor and body scrolling when the viewport changes without a reload.

Checks cover desktop, the exact 1499×543 touch viewport, 768px tablet, 390px phone and 320px phone, including resizing wide → phone → wide. Actual PostHog SDK requests are intercepted locally and their decoded event batches inspected for synthetic private test data. Tests do not send QA events to the real project. Fresh admin/proposal loads are checked for zero analytics requests.

## Release dependency review

The deployment review upgraded Angular within major version 21 to its patched 21.2 releases and removed the unused ngx-markdown/marked bootstrap and dependencies. No application template or service used MarkdownModule. Production dependency audits now report zero findings for frontend and backend. PostHog remains at the already-tested version. Development-tool advisories are excluded from these production audit counts. The existing home.scss warning budget remains below its error threshold.

PostHog validation covered five viewport layouts plus a resize-back state, with 12 real-SDK events intercepted and decoded locally and no private test data found. Private admin/proposal routes remain excluded. No QA events were sent to the live analytics project.
