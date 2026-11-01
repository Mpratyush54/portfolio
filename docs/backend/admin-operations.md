# Admin operations

Quotations, bookings and contacts use server-side pages of 25 with search,
status and date filters. Quotation results contain summaries only; opening one
fetches its agreement. The page limit is 100, filters are validated, regex search
is escaped, and compound status/date indexes keep ordinary lists bounded.
Legacy unpaginated callers receive at most 100 results. The scale test seeds
5,003 quotations and verifies the final page and searches older records.

Booking assignments store an assignee, HTTPS meeting link and internal notes.
Saving checks the last updated timestamp to avoid overwriting a newer update.
Only paid bookings can be marked completed; admin edits cannot mark a payment
paid or change its amount. Saving an assignment does not email a meeting link.

## Payment schedule

Guided drafts support four integer percentage shares totalling 100, an initial
payment slider, and before/after timing for the middle phases. Onboarding is
always before work; deployment remains after deployment approval, which starts
the existing support window. Every phase must be worth at least INR 1.
Before-phase requests require a written phase plan and explicit client approval;
the previous phase must be fully paid. The schedule is in the agreement, client
portal, PDF/Word exports and accepted fingerprint. Invited agreements are frozen;
changing them requires a revision, and a paid contract requires a change quote.

## Invitations

Each new link has its own record, label, expiry, email state and revocation.
Admin can recover/copy it without invalidating another link, email it to the
quotation's client, or revoke just that link. Revoke-all remains available.
Legacy hash-only links remain valid and can be revoked individually, but cannot
be recovered; issue a managed link when the original was lost.

`QUOTATION_INVITE_SECRET` must be 32 random bytes encoded as 64 hex characters,
stored outside Git in the backend environment / `portfolio-secrets`. HMAC tokens
are derived from each invitation ID and quotation ID; only their hashes are
stored. Preserve this dedicated key across deployments. Rotating it requires a
planned link migration because old link recovery would produce different tokens.
Links use URL fragments so access logs do not receive the capability. Keep
application analytics off private admin and quotation screens.

## Email and receipts

`MAIL_FROM` is the mail-provider-authorised sender (currently the requested
`no-reply@pratyushes.dev`); SMTP credentials stay in secrets. Client replies use
the configured booking/contact inbox. No new Razorpay permissions are required:
the application creates a payment acknowledgment from the server-verified capture,
including payment/order references, amount, phase and project balance. It is
distinct from a GST tax invoice. The booking confirmation and quotation-payment
email attach a PDF receipt. A captured payment with a scheduling conflict receives
an honest payment-received notice requesting scheduling/refund review.

Invitation and quotation-receipt outboxes retry every minute, in batches of 25,
with durable five-minute claims. Booking mail uses its existing per-recipient
claims. Failed invitation/receipt sends back off from one minute to one hour so bad
addresses cannot keep newer jobs out of the batch. An explicit admin retry clears
the delay.
Stable Message-ID headers reduce duplicate delivery after retries, but
SMTP and MongoDB cannot atomically commit together: a crash after mail acceptance
and before recording success can still cause a duplicate. Payment credit remains
idempotent independently of email. Failed quotation receipts can be retried from
their admin details; receipts are also downloadable there.

Daily activity summaries default to 21:00 Asia/Kolkata, editable under Settings.
They include new contacts and paid/review/completed bookings since the last
successful summary, with totals and up to 50 rows per category. Empty periods send
no mail. A shared per-day claim prevents duplicate summary sends across replicas;
the minute scheduler retries failures and catches a missed run after restart.
Manual summaries use the same delivery checkpoint. Settings show the sender,
recipient and SMTP configuration state. No customer data is sent in test runs.
