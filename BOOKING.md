# Admin and booking operation

Booking checkout and settings writes require MongoDB. The server initializes a
unique slot index before enabling checkout, and seeds booking settings from the
existing settings JSON only when no shared settings document exists. Later admin
edits live in MongoDB and survive pod replacement. Paid bookings no longer fall
back to container-local JSON files.

Configure `MONGO_URI`, `ADMIN_PASSWORD` and optionally `ADMIN_EMAIL`. Admin login
is unavailable without a configured password. Behind the Kubernetes ingress,
`TRUST_PROXY_HOPS=1` supplies the client address for rate limiting. Keep it unset
for a directly exposed development server.

## Razorpay setup

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a separate
`RAZORPAY_WEBHOOK_SECRET` in `portfolio-secrets`. Configure a Razorpay webhook for
the **payment.captured** event at:

```text
https://pratyushes.dev/api/bookings/webhook
```

Use the same webhook secret in the dashboard and Kubernetes. Checkout stays
disabled until the keys, webhook secret, and durable storage are available.
Configure automatic capture in Razorpay; an authorized payment is not yet treated
as a confirmed booking. Never use real payment keys for automated tests.

Reservations last 20 minutes. A unique slot key is acquired before creating an
order. Both the browser callback and signed raw-body webhook verify the gateway's
payment amount, currency, order, and captured state. A late payment may reclaim
an unsold slot. If another customer owns it, the booking becomes `payment_review`
and the customer is instructed to contact the owner. Review these records in
Admin → Discovery bookings → Payment review and arrange another time or a refund
in Razorpay; this code does not issue refunds automatically.

Checkout refuses a changed quote and asks the customer to review the new price.
Retrying a failed confirmation verifies the same payment rather than opening a
new checkout. Dismissing an unpaid checkout retains its order until the hold
expires. Booking emails have separate owner/visitor delivery claims, and failed
notifications are retried every minute. SMTP delivery cannot provide an absolute
exactly-once guarantee if a process crashes after SMTP accepts a message but
before its delivery state is saved.

Admin settings saves use a version number. If another admin tab updates settings,
reload them before saving again. Contact approvals and daily digest sends use
shared Mongo claims to prevent concurrent replicas sending the same notification.

Existing JSON contact/booking records are not automatically moved to MongoDB.
If such files contain needed historical data, import and reconcile them before
enabling payments. Conflicting historical paid bookings fail slot initialization
instead of reopening the slot for sale.

## Tests

```sh
cd backend
npm ci
npm test
npm audit --omit=dev

cd ../frontend
npm ci
node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/components/discovery-book/discovery-book.spec.ts --include=src/app/pages/admin/admin.spec.ts
npm run build
```

Backend tests start an isolated temporary MongoDB with fake gateway and email
adapters. They do not contact Razorpay, send email, or modify production data.
