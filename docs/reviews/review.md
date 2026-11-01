# Changes reviewed — 26 October 2026

Follow-up: the admin and booking findings 1–4 below, plus the default admin
password issue, have now been addressed in the local implementation. See
See [docs/booking.md](../booking.md) for operation and webhook setup. These fixes are not deployed yet.
The model cache finding remains outside the admin/booking change.

Compared the working files with GitHub main, including the local booking, digest,
contact and UI additions. The original workspace has incomplete `.git` metadata
(no HEAD/config/index), so it cannot provide a reliable staged/unstaged diff.
A separate checkout at `D:/portfolio-review` was used for Git history and the
deployment-fix PR. Existing local feature changes were not published.

## Deployment findings addressed

- **P1 — overlapping builds fail to publish image pins.** A real failed Actions
  run (`32999604838`) rejected the manifest push because main advanced. Publishing
  now fetches latest main, skips obsolete application sources, retries competing
  pushes, and serializes publishers. Five real-Git regression tests pass.
- **P2 — permanent Argo OutOfSync after excluding its own Application.** The
  cluster still tracked `argocd/portfolio` as a managed resource requiring pruning.
  Removed only its stale tracking annotation and refreshed the app. Verified
  `Synced` / `Healthy` and both images at `4fd968a`, without a manual restart or
  deletion. Do not prune/delete the Application to clear this warning.
- **P2 — manual dispatch did not publish image pins.** The original condition
  allowed only push events. Manual runs on main now publish too.
- **P2 — optional Argo refresh used the wrong HTTP verb and hid errors.** Refresh
  now uses GET with bounded timeouts and accepts a hostname or full HTTPS URL.
  Automated sync selects the current Git revision.
- Added deployment readiness/liveness checks and index-page cache revalidation.
  Restored the locally missing frontend Docker ignore file to keep local modules
  and build output out of the container build context.

The suspected `disable_globbing` problem was ruled out: Git supports the wildcard
pathspec itself and the latest existing workflow successfully committed pins.

## Bugs remaining in local feature changes

1. **P1 — the same slot can be sold twice.** `backend/server.js:455` checks for
   conflicts before awaiting a remote order creation at line 474; the booking is
   inserted afterwards. Two requests can both pass the check. The Booking schema
   has no unique slot reservation. Use an atomic shared reservation with an expiry
   before creating payment orders; process-local locking is insufficient during
   rolling deployments.
2. **P1 — late payments can confirm an already reassigned slot.** Pending holds
   expire after 20 minutes, but `backend/server.js:563` marks a booking paid without
   rechecking slot ownership or expiry. A customer can pay an older order after a
   second customer reserves the slot. Reconcile expired payments explicitly and
   provide a refund/rebooking path rather than confirming both bookings.
3. **P1 — paid orders can remain pending indefinitely.** Confirmation exists only
   in the checkout browser callback (`discovery-book.ts:338`). A closed tab or
   failed verify request leaves no server reconciliation path. Implement a signed,
   idempotent payment webhook or server reconciliation job, validating payment
   capture/status and amount against the stored order before confirmation.
4. **P1 — mutable data disappears on pod replacement.** Booking settings and
   digest state are always written under container-local `backend/data`; fallback
   bookings/contacts are too. The deployment has no persistent volume. Even with
   Mongo configured, settings reset and digest deduplication state is lost. Move
   operational state to the shared database and require durable storage for paid
   bookings. During rolling updates, two digest schedulers can also send duplicates
   without an atomic shared daily claim.
5. **P2 — model assets stay stale across releases.** `hero-scene.ts:477` and
   `:1327` use cache-first reads in the fixed `bud-models-v1` cache with unversioned
   model URLs. Replacing a GLB file on the server will not refresh returning users'
   cached model. Use content-versioned URLs/cache keys or revalidation.

Additional pre-existing issue: admin authentication falls back to the public
`admin123` password when the optional ADMIN_PASSWORD secret is absent
(`backend/server.js:81`). Fail closed when credentials are unconfigured.

## Validation and limits

- Local Angular production build passed; warnings remain for redundant optional
  chaining in discovery-book and home.scss exceeding its warning budget.
- Five publisher integration tests passed, including actual concurrent-push
  rejection/retry and stale-source protection.
- Actionlint passed for the revised workflow.
- Live Argo and deployment state checked over the existing SSH configuration.
- No real payment or email was sent. Payment findings are code-review findings,
  not production transaction tests. The local booking/UI changes are absent from
  GitHub main and are not included in the deployment PR.
