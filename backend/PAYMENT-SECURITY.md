# Payment verification and request limits

All API limits use atomic MongoDB counters with expiring buckets, shared across
replicas and restarts. Only hashes of limiter subjects are stored. Windows are
fixed; reaching a limit returns HTTP 429 and `Retry-After`. Protection fails closed
with HTTP 503 if its database is unavailable. Health probes remain outside quotas.

## Limits

| Request or operation | Limit |
| --- | --- |
| Public API reads | 240 per minute per client IP |
| Other public API writes | 60 per minute per client IP |
| Order endpoints, before validation | 30 per minute per client IP |
| Payment verification endpoints | 60 per minute per client IP |
| Booking order attempts with valid details | 8 per 15 minutes per IP and per email |
| Booking verification | 20 per minute per booking reference |
| Quotation order / verification | 10 / 30 per minute per invitation |
| Quotation read / write / export | 120 / 30 / 6 per minute per invitation |
| Admin requests / invalid credentials | 120 per minute per IP / 10 per 15 minutes per IP |
| Authenticated admin quotation exports | 10 per minute |
| Contact submissions | 6 per hour per IP; 3 per hour per IP and email |
| Invalid webhook signatures | 30 per minute per client IP |

Valid signed webhooks bypass visitor quotas, even if the invalid-webhook quota
is exhausted. Completed captured-payment deliveries are deduplicated in MongoDB
for seven days, separately for booking and quotations. Concurrent delivery workers
use a one-minute lease; failures are retriable and a crashed lease can expire.
Payment and milestone updates remain idempotent independently of these receipts.

## Client addresses

Express trusts one ingress hop. The backend service is ClusterIP; ingress must
overwrite client-supplied forwarding headers. Cloudflare's visitor-IP header is
used only when the ingress-verified source belongs to Cloudflare's published IP
ranges (checked 2026-10-27). Review those ranges when changing proxies/CDNs or
Cloudflare origin ranges. IPv4-mapped addresses are normalized and IPv6 addresses
share a /64 quota to prevent evasion by rotating interface addresses.

Sources: [Cloudflare IPv4](https://www.cloudflare.com/ips-v4),
[Cloudflare IPv6](https://www.cloudflare.com/ips-v6),
[visitor-IP headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/),
[Razorpay webhook verification](https://razorpay.com/docs/webhooks/validate-test/).

## Payment authority

The server allocates amounts from the accepted contract or current booking price;
clients cannot choose a smaller payable amount. An admin collection arrangement
does not change the accepted quotation total or clear the unpaid milestone balance.
Quotation acceptance and delivery approval are required before the respective order.

Browser callbacks require HMAC verification and order ownership. Webhooks require
HMAC verification of the exact raw body. Identifiers and JSON shape are validated.
The payment is then fetched from Razorpay and checked for the expected ID, order,
amount, INR currency, captured status and flag, and zero refunded amount before
fulfilment. HTTP calls to Razorpay time out after ten seconds. Request bodies and
upstream authorization details are not logged by the payment error handler.

These checks validate incoming confirmations. A later refund or dispute still
requires the existing manual reconciliation process; this release does not
automatically reverse a booked consultation or accepted project milestone.
When rotating webhook secrets, retain the old secret for outstanding Razorpay
retries through a separately planned rotation; do not acknowledge invalid signatures.

Tests use temporary MongoDB and fake/local gateways. Deployment checks must not
create live orders or charges, print secrets, or send test client emails.
