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
