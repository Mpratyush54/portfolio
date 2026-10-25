# Custom quotations, acceptance and milestone payments

Research checked 26 October 2026. This is an implementation decision record and editable contract starting point. The provider's identity, tax status, jurisdiction and business-specific promises still need to be entered before a real invitation is shared.

## Agreed commercial flow

The user confirmed four instalments: **25% before onboarding, 25% after MVP, 40% at development completion, 10% after deployment**. Cumulative paid totals are 25%, 50%, 90%, 100%. The server allocates whole paise and puts any rounding remainder into the final instalment, so their sum always equals the final quoted price.

1. Discovery call: existing `/book` flow, separate from a project contract. The call fee is shown before checkout. The implementation does not automatically deduct it from a project quote; write any agreed credit into the final quotation price and scope.
2. Admin creates a draft with client, provider details, final tax-inclusive payable total, validity, scope and measurable acceptance criteria, exclusions, timeline and full editable terms. Preview the draft in admin.
3. Admin freezes the draft and creates a private invitation. Copy/share it with the named client. No email is automatically sent. Sharing a link is an intentional admin action.
4. Client reads the full quotation and terms, can print/save a PDF, enters their name and invited email, and ticks four initially unchecked acknowledgements. The system records the exact revision, agreement SHA-256 digest, name, email, acknowledgements and server acceptance time. Accepting does not charge a card.
5. The first 25% becomes payable. All payment orders are created on the server from the stored quote price. No arbitrary client-supplied amount is accepted.
6. After the prior phase is paid, admin enters delivery/review evidence for MVP, development completion or production deployment. Client approves the delivery or submits specific changes. Only approval makes its instalment payable. There is no automatic acceptance from silence or a timer.
7. The first recorded production deployment starts a 30-calendar-day window. Resubmitting deployment notes does not restart this clock. Its exact start/end is shown in both portals. **Provisional coverage is agreed-scope bug fixes**, awaiting the user's answer about whether small changes should also be included. Terms can be edited before inviting a real client.
8. Full handover follows the accepted agreement. The starter terms transfer project-specific deliverables after full payment while preserving existing tools and third-party licences.

## Why these payment choices

[Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) requires a server-created order tied to checkout and distinguishes authorised from captured payments. This implementation uses **one order per approved instalment**, verifies browser signatures with the stored order, fetches payment status from Razorpay, and checks captured state, exact amount, currency and order. Reopening unpaid checkout reuses the stored order. A persisted, expiring ownership lock serialises order creation across replicas; a crashed preparation can be retried after five minutes. An order whose preparation never completed is not returned to the browser for payment.

[Payment Links](https://razorpay.com/docs/payments/payment-links/) also support partial payments, but a single partial-payment balance would not itself represent project acceptance or completion of four different deliveries. Separate orders give this portal an explicit gate for each phase. This is our product decision, not a Razorpay requirement to use four orders.

[Razorpay webhook best practices](https://razorpay.com/docs/webhooks/best-practices/) describe asynchronous, potentially duplicate delivery and retry behaviour. The separate quotation webhook checks the exact raw bytes with HMAC, reconciles captured payments using the API, and atomically records payment once. Browser confirmation and webhook confirmation converge on the same record. Unknown orders on the same Razorpay account are ignored. Pending or authorised payments never unlock the next phase. If browser verification fails after payment, the portal retries verification before offering another charge; webhook delivery can independently resolve the status.

This is a payment portal, not escrow, a recurring subscription or automatic debiting. Every instalment requires a separate client checkout. Refunds are not silently issued by a project-status change. [Razorpay refunds](https://razorpay.com/docs/payments/refunds/) are a separate payment operation; reconcile cancellations in writing and execute any agreed refund in the Razorpay Dashboard. Captured payment history remains captured history even when a refund is later issued; the current portal does not track refund lifecycle events, calculate net revenue or serve as a refund ledger.

## What every quotation should specify

- Provider legal identity, postal/contact details, applicable tax treatment and dispute venue. Enter actual details; never invent a GSTIN or assume tax exemption. The total entered is the **final payable INR amount including any applicable taxes**. A quote is not a tax invoice. Generate required tax invoices/advance receipts using your accounting process. CBIC's [invoice rules](https://cbic-gst.gov.in/gst-invoice-rules.html) distinguish invoices and receipt vouchers; the precise obligations depend on registration and supply details.
- Named client, authorised representative, project title, quote validity and exact revision.
- Deliverables and objective review criteria for MVP, development completion and deployment. Define supported browsers/devices, integrations, migration/content work, source code, documentation, credentials and handover.
- Included revision limits, explicit exclusions, third-party licences/hosting/domains, who pays recurring charges, and who owns and operates production accounts.
- Timeline assumptions, client content/access/feedback obligations and what happens during delays. Avoid promising a fixed deadline while inputs remain unspecified.
- Each payment trigger, final amount, any agreed discovery-fee credit, and the rule that the preceding instalment must be paid before proceeding.
- A written change-request process: describe and price extra work before starting it. Do not change accepted terms behind the client's back.
- Cancellation, payment for completed work, treatment of unused advances, refund initiation time and the distinction between initiation and bank processing. Starter terms avoid a blanket claim that all deposits are non-refundable.
- IP/licensing, handover, confidentiality and handling of credentials and client data.
- Exactly what the free support window covers, when it starts, how defects are reported, and what is excluded. A bug-fix window does not imply unlimited changes, ongoing maintenance or an uptime SLA.
- A contact path for disputes and data requests. Preserve mandatory legal rights rather than trying to waive them with a checkbox.

[Razorpay merchant terms](https://razorpay.com/terms/) require customer-facing terms and clear return/refund/cancellation policies with timelines, and prohibit storing payment-instrument credentials. Contract scope and refunds therefore appear before acceptance and payment, not only after checkout. Razorpay's hosted checkout handles payment credentials; this database stores order and payment references.

## Acceptance and invitation security

The IT Act's [section 10A](https://www.indiacode.nic.in/bitstream/123456789/13116/1/it_act_2000_updated.pdf) recognises that electronic form alone does not invalidate contract formation. It does not establish that this checkbox flow is a certified digital signature, prove who held the device, or prove that every word was read. The portal accurately calls this acceptance and records the version; it does not claim verified identity or guaranteed enforceability. Specific contracts can also need additional formalities depending on their facts.

Invitations contain a cryptographically random 256-bit capability. Only its hash is stored. The token lives in the URL fragment, then travels in a request header; it is not put in API query strings/access-log paths. Anyone with the link can read and act on that project: send it privately to the named client. Entering the visible invited email is a consistency check, **not independent email verification**. High-value engagements can add OTP or a dedicated e-sign provider later. The feature does not claim those are implemented.

Links expire after one year, with independent quotation acceptance validity of at most 90 days. Admin can rotate or revoke links without deleting agreement/payment history. Accepted projects remain viewable after quotation validity ends. Regenerating an invite revokes its old token. Invited drafts are frozen; revisions create a new record and revoke the original link. Once an order or payment exists, replacement is blocked: create a separate change quotation instead. Optimistic concurrency rejects stale admin and client writes.

No scroll-to-bottom gate attempts to prove reading. All terms remain expanded and printable, and four explicit acknowledgements cover scope, price/schedule, terms and authority. Accepted content is immutable through application routes. It is not a tamper-proof external evidence vault: database administrators can alter records. Include agreement/payment records in protected MongoDB backups and your document retention policy.

## Privacy and business setup still required

The [MeitY DPDP Rules and enforcement materials](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025%3B) and [government readiness programme](https://negd.gov.in/events/dpdp-act-readiness-workshop-b2b-and-b2c-implementation/) describe phased implementation. Do not assume a single commencement date applies to every obligation. This feature limits collected data to project contact, agreement and payment administration, uses no card storage and gives private, revocable access. That is not a declaration that the whole business is DPDP compliant.

Before live use, enter your actual privacy contact, retention/deletion process, legal identity and tax details; review the contract language for your business and clients. User business/GST details are still pending. Terms are editable per quotation so these can be supplied without a code deployment. Any automated retention/deletion system, OTP verification, invoice generation, email invitation delivery, accounting, chargeback management and refund automation would be additional features; none are claimed here.

## Setup and checks

- Requires persistent MongoDB and the existing protected `/admin` sign-in. Admin now includes the quotation editor, full preview, custom invite copy/rotation/revocation, client acceptance, delivery review and payment status.
- Client portal: `/proposal#<private-token>`. Keep real tokens out of screenshots and public PR descriptions.
- Use `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; set automatic capture in the Razorpay Dashboard. Keys remain server-side except the public key ID returned for checkout.
- Add **a second** Razorpay `payment.captured` webhook: `https://pratyushes.dev/api/quotations/webhook`, using the configured webhook secret. Keep the booking webhook as well. Both tolerate unrelated account orders.
- Test with Razorpay Test Mode before live credentials: accept a draft, pay 25%, release/approve MVP and pay 25%, release/approve development and pay 40%, record deployment/approve/pay 10%. Test modal cancellation, retries, invalid signatures, duplicate webhook delivery and requested changes. Automated tests use fake gateway adapters and temporary MongoDB, so they never move money or send invitations.
- No production deployment or real invitation has been performed. Existing draft PR changes must be merged for Argo to roll them out.


## Validation completed

- Backend: 47 passing tests using a temporary real MongoDB and fake Razorpay/email adapters, including all four phase payments, exact paise totals, expired/stale acceptance, terms freeze, invite rotation/revocation, concurrent order preparation, crashed lock recovery and duplicate/tampered webhooks.
- Frontend: 24 passing tests, including all required acceptance acknowledgements and retrying payment verification without opening another charge.
- Angular production build passes. Existing `home.scss` budget warning remains (37.18 kB against a 32 kB warning threshold; below the 40 kB error threshold).
- Browser QA: 58 states across 1440×900, 768×1024, 390×844, 320×568 and 844×390. Covers home, work/project detail, about, contact, booking, private quotation, acceptance, simulated payment, editor and invitation. No detected horizontal overflow or browser runtime errors. Mobile checks assert no mascot/cursor mount and exercise the ordinary contact form. Screenshots were visually inspected. Physical iOS/Android and real Razorpay Test Mode were not exercised.

## Guided editor update

New quotations now use a structured builder. Provider name, contact email, address, tax status/GSTIN and dispute venue have individual fields. Valid provider details are prefilled from the latest guided quotation when available. Deliverables have checkboxes with generated acceptance criteria; exclusions and client responsibilities have their own checkboxes. Revision rounds, project weeks and review business days use bounded numeric controls. Project-specific pages/flows and acceptance details still need a short description so standard choices cannot accidentally promise an undefined project.

The full agreement starts with 16 populated editable sections: parties/scope; phase payments; price/taxes/payment processing; review; revisions/change requests; schedule/dependencies; third-party services; deployment/operations; 30-day support; cancellation/refunds; ownership/licensing/handover; confidentiality/portfolio permission; privacy/security; quality/mandatory rights; events beyond control; communication/law/disputes. Portfolio permission defaults to off. The default support clause covers defects reported during the 30-day window even if the correction finishes later.

Preview and save generate the contract on the server from validated selections, inserting review/revision counts, duration, provider contact, venue and portfolio permission. Unknown choices/placeholders, omitted clauses, missing provider details and invalid tax/numeric selections are rejected. Preview is a snapshot of the current choices when clicked; save always regenerates current choices. Exact clause edits and builder selections persist through reload/revision, while invited/accepted documents remain frozen. Existing text-only drafts retain their negotiated wording and original editor.

Additional validation: six template-generation/validation tests, one MongoDB persistence/revision test and four guided editor tests. Desktop, 390px and 320px browser checks exercise checkbox changes, clause edits, server preview, save and reopening without lost selections or wording. No real invitations or payments were sent.
