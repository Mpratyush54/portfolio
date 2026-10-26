# Release review 26 October 2026

Reviewed the combined booking/admin, responsive UI, quotation/SRS, PostHog and Argo publisher changes before deployment.

## Findings resolved

- Concurrent booking reservations, expired-slot payment reconciliation, captured-payment webhooks, shared settings, notification claims and fail-closed admin credentials are covered by backend regression tests.
- Quotation autosave preserves unfinished drafts, retries with mutation IDs, rejects stale writes and flushes before closing/navigation/sign-out. SRS bytes live in GridFS, are private and become immutable with the invited agreement. PDF/Word exports include the complete canonical agreement and attachment fingerprints.
- Responsive navigation follows viewport width independently of coarse-pointer detection. Compact screens omit custom cursor/mascot extras. Public analytics strips form and private-route data.
- Returning desktop browsers revalidate GLB model bytes. Tests cover changed assets, offline fallback and cache quota failure.
- Angular 21 was updated to patched releases, and unused Markdown bootstrap/dependencies were removed. Frontend and backend production dependency audits report zero findings. Development tooling audit findings are outside the shipped browser/server dependency counts.
- Backend readiness waits for MongoDB and booking initialization; rolling updates retain the old replica until the new one is ready. Both builds/runtimes use Node 22, matching CI.
- The image publisher uses full SHA tags, skips obsolete builds and retries concurrent Git pushes. Five real-Git publisher tests pass. No GitHub App is required for Argo polling and automatic reconciliation.

## Validation

53 backend tests and 39 frontend tests pass. Angular production build passes with the existing home.scss warning below its error threshold. Desktop, 390px and 320px journeys exercise actual temporary MongoDB-backed draft save/reload, SRS upload/download, PDF/Word exports and save-before-sign-out. Previous UI checks cover desktop/tablet/phone/landscape and wide touch emulation. Server-side Kubernetes validation passes for the combined deployments, analytics configuration and ingress upload limit. No test charge or visitor email is sent.

## Environment and rollout

Non-Razorpay local settings were copied directly over SSH into the existing portfolio-secrets Kubernetes Secret, preserving unrelated keys and verifying the transferred values without printing credentials. The local .env remains untracked and is excluded from Docker contexts. Razorpay credentials/webhook secret were deliberately not configured: online checkout remains disabled and the booking page offers the configured email contact route. The incoming backend rollout loads the transferred environment.

Deployment must be verified against the final image SHA and Argo Synced/Healthy state, plus public pages, authenticated admin reads, Mongo readiness, analytics configuration and disabled-payment status. Do not infer deployment completion from a successful image build alone.


## Verified live deployment

Completed at 26 October 2026 03:53 IST. PRs #2 and #3 are merged into main. The release image SHA is `8aa7a3a8ff100414cb53e9be20d8612550ccab39`; GitHub Actions committed its image pins as `d67f1d03df5593d0337fd7f46cf27997175429d9`. Build/publish run `40239066488` and test run `40239066465` succeeded. Argo picked up the image pin through its normal polling and reports Synced / Healthy; backend and frontend rollout status succeeded, with new containers reporting zero restarts. No manual production server restart or pod deletion was needed.

Public-domain checks at https://pratyushes.dev passed for Mongo-ready health, authenticated admin status/quotations/defaults/settings/inbox/booking reads, configured PostHog runtime settings, and disabled payments. Admin rejects unauthenticated reads with 401; private quotation reads/exports reject access without a token. The index uses no-cache and analytics runtime configuration uses no-store. Twenty-eight live page checks passed across desktop, the 1499x543 touch-capable viewport, 390px and 320px screens, with no detected horizontal overflow or browser runtime errors. The compact layouts omit the mascot and use correctly positioned navigation. The booking page offers the configured email contact route while Razorpay is unconfigured. QA analytics requests were intercepted and no synthetic contact, invitation, email or charge was created on production.

## Proposal agreement presentation update

26 October 2026: the private proposal now uses a document layout with a parties section, project fee and revision summary, section navigation, milestone payment table, structured requirements and all saved agreement clauses rendered as literal text. The admin preview uses the same clause renderer. Section navigation preserves the invitation hash. Existing quotation data and acceptance fingerprints are unchanged by display/export operations.

PDF and Word exports now include document metadata, readable numbered clauses, a milestone table with cumulative paid percentages, SRS references, acceptance status/record, running headers and page numbers. PDF pagination keeps headings with the first paragraph; Word uses native headings, repeating table headers and widow control. Exports remain behind the existing private-token/admin checks. No Razorpay configuration was added.

Validation: 54 backend tests and 41 frontend tests pass; the production build passes with the existing home stylesheet warning. A synthetic proposal was visually reviewed at desktop, 320px and 390px widths. All eight PDF pages and six Word pages were rendered and reviewed. No real client agreement or production data was created for QA.
Verified live rollout: application image 2e5f42a2becdc04b177aa09ad0c0acccfa520330, manifest commit 02b8d90a3811fb9af595187a227164189d8bd099. GitHub build/publish and test runs succeeded; Argo Synced / Healthy and both deployments ready 1/1. Live health reports ready; unauthenticated quotation reads/exports remain rejected; online payments remain disabled.

## Public services and Razorpay review update

26 October 2026: replaced the academic/project work showcase with a dedicated public services catalogue. Legacy project links redirect to /work. No paid client work or customer endorsements are claimed. Five fixed-scope INR base packages cover business websites (14,999), backend/API work (24,999), DevOps deployment (9,999), AWS reviews (14,999) and a website/backend launch bundle (39,999). Deliverables, exclusions, input-dependent estimates, third-party costs and custom-scope quotations are explicit.

The optional 30-minute technical consultation is distinct from free project enquiries and implementation. Production booking settings use the existing INR 1,199 base fee as a fixed fee, preserving disabled online payments. Public terms, privacy, cancellation/refunds and digital service delivery pages explain the service and quotation process. The 25/25/40/10 schedule and 30-calendar-day defect support match the project workflow. No Razorpay credentials were configured.

Validation: 54 backend tests and 42 frontend tests pass, including public service visibility before checkout activation and normal page scrolling on /work. The Angular production build passes with the existing home stylesheet size warning. Desktop and 320px/390px visual reviews passed; legacy project redirects and public terms/contact navigation were checked. Fixed an anchor/base-URL interaction that sent Explore packages to the home route. A three-page merchant review PDF was rendered and visually checked; it contains public URLs, actual package scopes/prices and an illustrative milestone calculation, without publishing a private client quotation.

The services and public policy pages use the landing page's Outfit typography, dark background, muted text, rounded cards and pill navigation after visual consistency review. Desktop and compact layouts were rechecked after this correction.

Home and /work now render the same primary-navigation component, including desktop pill labels/active state and the mobile navigation bar at the shared 900px breakpoint. Home retains its existing view-switch and deferred scene behavior; returning to Home/About/Contact also restores the correct page title and description.

Package discussion buttons open /book. The booking and services pages share the public header and the same primary navigation used on Home; mobile content retains bottom spacing for the fixed navigation bar.

The services page now uses unbulleted, aligned scope rows, full-width labelled project terms, a structured consultation panel with a published-fee fallback and a plain four-step delivery process. Contact is a dedicated scrolling page with one standard form at every viewport; hiring/chat flows are removed from the public contact journey. The form preserves entries after failure, blocks duplicate submissions and tracks only successful sends. Validation now passes 45 frontend tests (12 files), including three new enquiry regressions; the production build passes. The contact route is covered by the normal-page scrolling regression.

The booking page shows an unavailable calendar when checkout is disabled, rather than the previous service-information block. Duration and fee remain visible, all appointment dates are disabled, and checkout advancement is blocked. Availability is labelled accurately without inventing client bookings. Slot-loading completion marks the view for checking. All 46 frontend tests pass, including the disabled-calendar UI/selection regression; the production build passes.
