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
