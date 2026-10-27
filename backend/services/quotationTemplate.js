const { httpError } = require('./bookingValidation');
const features = [
  {
    id: 'website',
    label: 'Website / landing pages',
    acceptance:
      'All named pages display the approved content, navigation and calls to action without broken internal links.',
  },
  {
    id: 'responsive',
    label: 'Responsive mobile layout',
    acceptance:
      'The agreed screens are usable at 320px, tablet and desktop widths without horizontal overflow; controls remain usable by touch.',
  },
  {
    id: 'auth',
    label: 'Sign-in and user accounts',
    acceptance:
      'The agreed sign-in, sign-out and account recovery flows work; protected routes reject unauthorised users.',
  },
  {
    id: 'booking',
    label: 'Booking / appointment flow',
    acceptance:
      'Clients can choose an available slot, submit required details and receive a confirmed status; duplicate reservations are prevented.',
  },
  {
    id: 'payments',
    label: 'Razorpay checkout',
    acceptance:
      'Agreed checkout flows pass Razorpay Test Mode checks, including cancellation, signature verification and captured-payment confirmation. Live activation depends on the client account and credentials.',
  },
  {
    id: 'admin',
    label: 'Admin dashboard',
    acceptance:
      'Authorised administrators can perform the listed management actions; ordinary users cannot access those actions.',
  },
  {
    id: 'api',
    label: 'Backend APIs and database',
    acceptance:
      'The agreed endpoints validate inputs, enforce access rules and persist/retrieve the listed records; error cases return appropriate responses.',
  },
  {
    id: 'notifications',
    label: 'Email notifications',
    acceptance:
      'The listed events deliver the agreed messages using the configured provider, with failure handling; inbox placement depends on the email provider.',
  },
  {
    id: 'deployment',
    label: 'Production deployment',
    acceptance:
      'The agreed release is deployed to the named environment with HTTPS and a working health check; the client receives deployment/access notes.',
  },
  {
    id: 'handover',
    label: 'Source code and handover notes',
    acceptance:
      'The agreed repository/source, setup steps, configuration reference and access handover are supplied after full payment.',
  },
];
const exclusions = [
  {
    id: 'hosting',
    label: 'Hosting, domain renewals and infrastructure charges',
  },
  {
    id: 'subscriptions',
    label: 'Paid APIs, SMS/email usage and third-party subscriptions',
  },
  {
    id: 'content',
    label: 'Copywriting, photography, logo creation and content entry',
  },
  { id: 'migration', label: 'Historic data migration and bulk data cleaning' },
  {
    id: 'mobileApps',
    label: 'Native Android/iOS apps and app-store submissions',
  },
  {
    id: 'maintenance',
    label: 'Ongoing operations and maintenance after the support window',
  },
  {
    id: 'certification',
    label:
      'Formal security audit, penetration test or compliance certification',
  },
];
const responsibilities = [
  {
    id: 'content',
    label:
      'Supply approved content, branding and assets with permission to use them',
  },
  {
    id: 'access',
    label:
      'Provide required hosting, domain, API and payment-provider access securely',
  },
  {
    id: 'contact',
    label:
      'Nominate one authorised contact to consolidate decisions and feedback',
  },
  {
    id: 'feedback',
    label:
      'Review deliveries and provide consolidated, specific feedback within the review window',
  },
  {
    id: 'accounts',
    label:
      'Own and maintain production accounts and pay agreed third-party charges directly',
  },
];
const clauses = [
  {
    id: 'agreement',
    title: 'Parties, scope and order of precedence',
    text: 'This agreement is between the provider identified in this quotation and the named client. The accepted quotation, its deliverables, exclusions, milestone schedule and these terms form the project agreement. Only expressly listed work is included. Agreed project-specific additions apply alongside these terms; any conflict must be resolved in a written revision accepted by both parties before the affected work starts. The signer confirms authority to act for the client.',
  },
  {
    id: 'milestones',
    title: 'Four delivery phases and payment triggers',
    text: 'Onboarding: 25% is payable after quotation acceptance and before project work begins. MVP: another 25% is payable after the client approves the agreed core working flow, bringing the paid total to 50%. Development complete: another 40% is payable after approval of all remaining agreed features and testing, bringing the paid total to 90%. Deployment: the final 10% is payable after production deployment and client approval, bringing the total to 100%. Completion is measured against the written scope and acceptance criteria, not the addition of unquoted features. Source/IP handover follows full payment.',
  },
  {
    id: 'payment',
    title: 'Price, taxes and payment processing',
    text: 'The displayed quotation total is the final payable INR amount, including applicable taxes identified in the provider details. Instalment amounts are shown separately; rounding in paise is reconciled in the final instalment. Work on the next phase begins after the preceding payment is captured. Acceptance alone does not charge the client and no future instalment is automatically debited. Razorpay processes payment credentials; this portal stores payment references and confirmation status. An authorised or pending payment is not treated as received until capture is verified. A quotation or portal payment status is not a tax invoice; the provider supplies required invoices/advance receipts through its accounting process. Any agreed discovery-call credit must already be reflected in the final price.',
  },
  {
    id: 'review',
    title: 'Delivery review and acceptance',
    text: 'The client should review each delivery within {{reviewDays}} business days and approve it or report specific failures against the agreed criteria, with steps/screenshots where possible. A reported agreed-scope defect is corrected and submitted again for review. Silence, opening the link, or the passing of the review period does not automatically approve a milestone. If feedback is delayed, dependent work and the delivery schedule may pause. Approval records the delivery version reviewed. The next instalment becomes available only after explicit client approval, except the initial onboarding instalment which follows agreement acceptance.',
  },
  {
    id: 'revisions',
    title: 'Included revisions and change requests',
    text: '{{revisionRounds}} consolidated revision round(s) per milestone are included for adjustments within the agreed scope. A round means one consolidated feedback list followed by its implementation and review. Correcting a reproducible failure to meet the agreed acceptance criteria does not consume a design-revision round. New features, altered business rules, new integrations, additional pages beyond scope, major redesign after approval and extra revision rounds require a separately priced written change quotation accepted before work begins. Related cost and timeline effects must be agreed in advance.',
  },
  {
    id: 'timeline',
    title: 'Schedule, dependencies and project pauses',
    text: 'The planning estimate is {{weeks}} week(s) from receipt of the onboarding payment and all agreed starting inputs. The specific timeline and dependencies in this quotation govern phase planning. The client supplies the listed content, permissions, credentials, decisions and feedback. Delays caused by missing inputs, late approvals, changed scope, provider outages or access restrictions require an updated written schedule; they do not create automatic acceptance or an automatic penalty. A stalled project may be paused with written notice. Restart timing is agreed with regard to current availability; no unquoted restart fee is automatically applied.',
  },
  {
    id: 'thirdParty',
    title: 'Third-party services and excluded costs',
    text: 'Hosting, domains, email/SMS providers, paid APIs, licences and external subscriptions are included only where this quotation expressly says so. Otherwise they are excluded costs payable by the client, and no such purchase is made on the client’s behalf without approval. Third-party service terms, account approval, usage limits, pricing and outages remain controlled by those providers. Changes to external APIs or platforms after acceptance may require a new change quotation. No uptime SLA, formal security certification, app-store approval, search ranking or business-revenue outcome is promised unless separately agreed.',
  },
  {
    id: 'deployment',
    title: 'Production deployment and operational responsibility',
    text: 'Deployment means the agreed release is made available in the agreed production environment and its deployment date is recorded with review evidence. The client supplies or authorises production accounts, domain settings, required credentials and payment activation. The provider performs the deployment checks stated in scope and supplies the agreed handover notes. Ongoing monitoring, backups, incident response, hosting administration and operational availability are the client’s responsibility unless expressly included under a separate agreement. Credentials must be shared securely, never pasted into quotation notes.',
  },
  {
    id: 'support',
    title: '30-day free support and defect reporting',
    text: 'Free support lasts 30 calendar days from the first recorded production deployment date, ending at the timestamp shown in the portal. It covers reproducible defects where the delivered work fails the accepted scope and criteria. Report issues to {{providerEmail}} with a description, reproduction steps and relevant screenshots/logs without secrets. Issues reported during the window remain eligible for assessment and correction even if the correction finishes later. The provider acknowledges and schedules work according to severity and availability; no 24/7 or fixed response/resolution SLA is included. New features, redesigns, content changes, misuse, client/third-party modifications, third-party outages and new platform requirements are excluded. Re-deploying a fix does not restart or extend the window unless separately agreed.',
  },
  {
    id: 'cancellation',
    title: 'Cancellation, termination and refunds',
    text: 'Either party may request cancellation or raise a material breach by written email to the project contacts. The parties first document completed/accepted work, unfinished work, paid instalments, approved non-recoverable external costs and any outstanding obligations. Completed and accepted work remains payable. Unperformed work and unused advances are reconciled fairly in writing; there is no blanket rule that every advance is non-refundable. Any agreed refund is initiated within 7 business days of reconciliation and confirmation of the payment reference; bank/payment-provider processing can take longer. Refunds normally return through the original payment method. Cancellation does not automatically trigger a refund in the portal. Mandatory statutory rights are preserved. No new unapproved work or charges accrue after the agreed termination date.',
  },
  {
    id: 'ip',
    title: 'Ownership, licences and handover',
    text: 'After full payment, the client receives the agreed project-specific deliverables, source code and ownership rights that the provider is entitled to transfer. The provider retains pre-existing libraries, general tools, reusable know-how and components identified as pre-existing; the client receives the usage rights necessary for the agreed deliverable, subject to applicable licences. Open-source and third-party components retain their original licence terms. Client-supplied content and trademarks remain the client’s property. The client warrants that it has permission to supply those materials. Handover includes only the assets, documentation and accounts expressly listed in scope; secrets are transferred securely and access should be rotated afterwards.',
  },
  {
    id: 'confidentiality',
    title: 'Confidentiality and portfolio use',
    text: 'Both parties protect non-public project, commercial and access information and use it only for performing this project, except where disclosure is legally required or information is already lawfully public. Necessary service providers may receive only the information required for their role under appropriate confidentiality/security arrangements. Credentials, customer datasets and private business information must not appear in public repositories or portfolio screenshots. Portfolio/publicity permission for this project: {{portfolioPermission}}. Confidentiality does not prevent either party retaining records required for accounting, legal obligations or resolving a dispute.',
  },
  {
    id: 'privacy',
    title: 'Project data, privacy and security',
    text: 'Client contact details, quotation content, acceptance records and payment references are used to administer the project, communicate about deliveries, meet record obligations and resolve disputes. Payment credentials are handled by Razorpay and are not stored by this site. Both parties use reasonable access controls and share only necessary project data through agreed channels. The client must identify any personal, regulated or sensitive production data before development so required processing arrangements can be agreed; production datasets are not assumed necessary for testing. Requests about access, correction, deletion or retention should go to {{providerEmail}}. Deletion remains subject to required record retention and legal obligations. Specific hosting location, retention periods, subprocessors or data-processing commitments must be agreed separately when required; no compliance certification is implied.',
  },
  {
    id: 'warranty',
    title: 'Quality, limitations and mandatory rights',
    text: 'The provider will perform the agreed work with reasonable care and skill and correct agreed-scope defects under the review/support provisions. Software is not promised to be entirely defect-free or immune to every security threat. The provider does not guarantee results controlled by third parties or commercial outcomes. Each party should mitigate avoidable losses and promptly report material problems. No term excludes liability or consumer/statutory remedies that applicable law does not permit to be excluded. Any additional liability cap, indemnity, service level or warranty must be specifically agreed in a written revision; none is silently created by a checkbox.',
  },
  {
    id: 'events',
    title: 'Events beyond reasonable control',
    text: 'A party affected by an event beyond its reasonable control should notify the other promptly, explain the likely impact and take reasonable steps to reduce delay. The parties agree an updated schedule or, if continuing is impractical, reconcile termination under the cancellation clause. Such an event does not erase payment for already accepted work or automatically remove rights to unused advances.',
  },
  {
    id: 'disputes',
    title: 'Communication, governing law and dispute resolution',
    text: 'Operational decisions, approvals and change requests are documented in this portal or written correspondence between the named project contacts. Raise a dispute first through {{providerEmail}} and seek a good-faith written resolution before escalation. Governing law: laws of India. Proposed dispute venue: {{venue}}, subject to mandatory jurisdiction and statutory rights. There is no compulsory arbitration clause unless separately agreed. Quotation validity controls the deadline for initial acceptance; it does not terminate an already accepted agreement. Later amendments require explicit written acceptance of the revised terms by both parties.',
  },
];
function defaults() {
  return {
    version: 1,
    provider: {
      name: '',
      email: 'developer@pratyushes.dev',
      address: '',
      taxStatus: '',
      gstin: '',
      taxNote: '',
      venue: '',
    },
    features: ['website', 'responsive', 'deployment', 'handover'],
    exclusions: [
      'hosting',
      'subscriptions',
      'content',
      'migration',
      'mobileApps',
      'maintenance',
      'certification',
    ],
    responsibilities: responsibilities.map((x) => x.id),
    scopeNotes: '',
    exclusionNotes: '',
    timelineNotes: '',
    revisionRounds: 2,
    reviewDays: 5,
    weeks: 4,
    portfolio: false,
    clauses: clauses.map((c) => ({ ...c })),
    additionalTerms: '',
  };
}
function compile(input, paymentSchedule) {
  if (!input || input.version !== 1)
    throw httpError(400, 'Unsupported quotation builder version.');
  const text = (v, label, max, required = true) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
      throw httpError(400, `Provide ${label} (maximum ${max} characters).`);
    return v.trim();
  };
  const pick = (ids, options, label, required = true) => {
    if (
      !Array.isArray(ids) ||
      ids.length > options.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !options.some((o) => o.id === id)) ||
      (required && !ids.length)
    )
      throw httpError(400, `Choose valid ${label}.`);
    return options.filter((o) => ids.includes(o.id));
  };
  const p = input.provider || {};
  const provider = {
    name: text(p.name, 'provider legal name', 120),
    email: text(p.email, 'provider contact email', 254),
    address: text(p.address, 'provider address', 500),
    taxStatus: p.taxStatus,
    gstin: text(p.gstin || '', 'GSTIN', 15, false),
    taxNote: text(p.taxNote || '', 'tax treatment', 500, false),
    venue: text(p.venue, 'dispute venue', 160),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.email))
    throw httpError(400, 'Enter a valid provider contact email.');
  if (!['not_registered', 'registered', 'other'].includes(provider.taxStatus))
    throw httpError(400, 'Choose the provider GST/tax status.');
  if (
    provider.taxStatus === 'registered' &&
    !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(provider.gstin)
  )
    throw httpError(400, 'Enter the 15-character GSTIN.');
  if (provider.taxStatus === 'registered' && !provider.taxNote)
    throw httpError(400, 'Describe included GST/tax treatment.');
  if (provider.taxStatus === 'other' && !provider.taxNote)
    throw httpError(400, 'Describe the applicable tax treatment.');
  const selected = pick(input.features, features, 'deliverables'),
    excluded = pick(input.exclusions, exclusions, 'exclusions', false),
    duties = pick(
      input.responsibilities,
      responsibilities,
      'client responsibilities',
    );
  for (const [key, max] of Object.entries({
    revisionRounds: 10,
    reviewDays: 30,
    weeks: 52,
  }))
    if (
      !Number.isInteger(input[key]) ||
      input[key] < (key === 'revisionRounds' ? 0 : 1) ||
      input[key] > max
    )
      throw httpError(400, `Choose a valid ${key}.`);
  if (typeof input.portfolio !== 'boolean')
    throw httpError(400, 'Choose the portfolio permission.');
  const clean = {
    version: 1,
    provider,
    features: selected.map((x) => x.id),
    exclusions: excluded.map((x) => x.id),
    responsibilities: duties.map((x) => x.id),
    scopeNotes: text(
      input.scopeNotes || '',
      'project-specific scope and acceptance criteria',
      3000,
    ),
    exclusionNotes: text(
      input.exclusionNotes || '',
      'additional exclusions',
      1000,
      false,
    ),
    timelineNotes: text(
      input.timelineNotes || '',
      'timeline notes',
      1000,
      false,
    ),
    revisionRounds: input.revisionRounds,
    reviewDays: input.reviewDays,
    weeks: input.weeks,
    portfolio: input.portfolio,
    clauses: [],
    additionalTerms: text(
      input.additionalTerms || '',
      'additional agreement terms',
      1800,
      false,
    ),
  };
  if (
    !Array.isArray(input.clauses) ||
    input.clauses.length !== clauses.length ||
    input.clauses.some(
      (c) => !c || typeof c !== 'object' || typeof c.id !== 'string',
    )
  )
    throw httpError(400, 'Include every agreement section.');
  const values = {
    reviewDays: clean.reviewDays,
    revisionRounds: clean.revisionRounds,
    weeks: clean.weeks,
    providerEmail: provider.email,
    venue: provider.venue,
    portfolioPermission: clean.portfolio
      ? 'The client permits the provider to identify this project and show publicly released work, without confidential data.'
      : 'No public portfolio listing, client logo or project screenshots without separate written permission.',
  };
  const render = (s) =>
    s.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      Object.hasOwn(values, key) ? String(values[key]) : match,
    );
  for (const clause of clauses) {
    const supplied = input.clauses.find((c) => c.id === clause.id);
    if (!supplied) throw httpError(400, `Include ${clause.title}.`);
    clean.clauses.push({
      id: clause.id,
      title: clause.title,
      text: text(paymentSchedule && clause.id === 'milestones'
        ? require('./paymentPlan').wording(paymentSchedule)
        : paymentSchedule && clause.id === 'review' && supplied.text === clause.text
          ? 'The client explicitly approves the agreed delivery for an after-phase payment, or the written phase plan for a before-phase payment. A phase-plan approval authorises the stated advance payment; it does not state that development is already delivered. Agreed-scope defects are corrected and reviewed again. Silence never counts as approval. Dependent work and delivery dates may pause while payment, required inputs or review are outstanding.'
          : supplied.text, clause.title, 2500),
    });
  }
  const terms =
    clean.clauses
      .map((c, i) => `${i + 1}. ${c.title}\n${render(c.text)}`)
      .join('\n\n') +
    (clean.additionalTerms
      ? '\n\nProject-specific additional terms\n' + clean.additionalTerms
      : '');
  if (/\{\{\w+\}\}/.test(terms))
    throw httpError(
      400,
      'Resolve unknown agreement placeholders before saving.',
    );
  const result = {
    builder: clean,
    seller: `${provider.name}\nContact: ${provider.email}\nAddress: ${provider.address}\n${provider.taxStatus === 'registered' ? `GST registered; GSTIN: ${provider.gstin}. ${provider.taxNote}` : provider.taxStatus === 'not_registered' ? 'Not GST registered; GST is not charged on this quotation. ' + provider.taxNote : provider.taxNote}\nGoverning law: India. Dispute venue: ${provider.venue}, subject to mandatory jurisdiction.`,
    scope:
      selected
        .map((f) => `• ${f.label}\nAcceptance: ${f.acceptance}`)
        .join('\n\n') +
      '\n\nProject-specific deliverables and criteria\n' +
      clean.scopeNotes,
    exclusions:
      (excluded.map((x) => '• ' + x.label).join('\n') ||
        'No standard exclusions selected; only expressly listed scope is included.') +
      `\nIncluded revisions: ${clean.revisionRounds} consolidated round(s) per milestone; agreed-scope defect corrections do not consume these rounds.` +
      (clean.exclusionNotes
        ? '\nAdditional exclusions: ' + clean.exclusionNotes
        : ''),
    timeline:
      `Planning estimate: ${clean.weeks} week(s) after onboarding payment and required inputs.\nReview target: ${clean.reviewDays} business days per delivery; silence does not imply approval.\nClient responsibilities:\n${duties.map((x) => '• ' + x.label).join('\n')}` +
      (clean.timelineNotes
        ? '\nProject schedule and dependencies: ' + clean.timelineNotes
        : ''),
    terms,
  };
  for (const [key, max] of Object.entries({
    seller: 2500,
    scope: 7000,
    exclusions: 3000,
    timeline: 3000,
    terms: 14000,
  }))
    if (result[key].length > max)
      throw httpError(
        400,
        `Generated ${key} exceeds ${max} characters. Shorten the custom wording.`,
      );
  return result;
}
module.exports = {
  catalog: { features, exclusions, responsibilities },
  clauses,
  defaults,
  compile,
};
