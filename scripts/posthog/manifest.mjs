export const MANAGED_MARKER = '[managed:portfolio-posthog:v1]';
const range = { date_from: '-30d' };
const event = (name, properties) => ({
  kind: 'EventsNode',
  event: name,
  name,
  ...(properties ? { properties } : {}),
});
const percentile = (name, mathProperty) => ({
  kind: 'EventsNode',
  event: name,
  name,
  math: 'p75',
  math_property: mathProperty,
});
const property = (key, value, operator = 'exact') => ({
  type: 'event',
  key,
  operator,
  value: Array.isArray(value) ? value : [value],
});
const trend = (series, options = {}) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'TrendsQuery',
    series: series.map((item) => (typeof item === 'string' ? event(item) : item)),
    dateRange: range,
    interval: options.interval || 'day',
    ...(options.breakdown
      ? { breakdownFilter: { breakdown: options.breakdown, breakdown_type: 'event' } }
      : {}),
    ...(options.display ? { trendsFilter: { display: options.display } } : {}),
  },
});
const funnel = (steps, minutes = 30) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'FunnelsQuery',
    series: steps.map((step) =>
      typeof step === 'string' ? event(step) : event(step.event, step.properties),
    ),
    dateRange: range,
    funnelsFilter: {
      funnelVizType: 'steps',
      funnelOrderType: 'ordered',
      funnelWindowInterval: minutes,
      funnelWindowIntervalUnit: 'minute',
    },
  },
});

export const dashboards = [
  {
    name: 'Portfolio / Executive',
    description: 'Public-site demand and successful customer outcomes.',
    insights: [
      ['Public pageviews', trend(['$pageview'])],
      ['Contact submissions', trend(['contact_submitted'])],
      ['Booking confirmations', trend(['booking_confirmed', 'booking_verification_confirmed'])],
      ['Quotation acceptances', trend(['quotation_accepted'])],
      ['Quotation payment confirmations', trend(['quotation_payment_confirmed', 'quotation_verification_confirmed'])],
      [
        'Booking conversion',
        funnel([
          { event: '$pageview', properties: [property('$pathname', '/book')] },
          'booking_confirmed',
        ]),
      ],
      ['Quotation acceptance rate', funnel(['quotation_viewed', 'quotation_accepted'], 1440)],
    ],
  },
  {
    name: 'Portfolio / Booking Funnel',
    description: 'Anonymous same-visit movement from availability selection to confirmation.',
    insights: [
      [
        'Booking conversion funnel',
        funnel([
          { event: 'booking_step_viewed', properties: [property('step', 'time')] },
          { event: 'booking_step_viewed', properties: [property('step', 'details')] },
          { event: 'booking_step_viewed', properties: [property('step', 'checkout')] },
          'booking_checkout_opened',
          'booking_confirmed',
        ]),
      ],
      ['Booking payment reviews', trend(['booking_payment_review', 'booking_verification_review'])],
      ['Authoritative booking confirmations', trend(['booking_verification_confirmed'])],
    ],
  },
  {
    name: 'Portfolio / Quotation Payment Funnel',
    description: 'Private proposal progression without invitation, customer, or payment identifiers.',
    insights: [
      [
        'Quotation acceptance and payment funnel',
        funnel(
          [
            'quotation_viewed',
            'quotation_accepted',
            'quotation_payment_checkout_opened',
            'quotation_payment_confirmed',
          ],
          1440,
        ),
      ],
      [
        'Quotation payment outcomes',
        trend([
          'quotation_payment_confirmed',
          'quotation_payment_failed',
          'quotation_payment_dismissed',
        ]),
      ],
      [
        'Checkout opened by milestone',
        trend(['quotation_payment_checkout_opened'], { breakdown: 'milestone_index' }),
      ],
      [
        'Authoritative quotation confirmations by milestone',
        trend(['quotation_verification_confirmed'], { breakdown: 'milestone_index' }),
      ],
    ],
  },
  {
    name: 'Portfolio / Reliability',
    description: 'Client exceptions, backend failures, and failed transactional journeys on public routes.',
    insights: [
      ['Browser exceptions', trend(['$exception'], { interval: 'hour' })],
      ['Backend API errors', trend(['api_error'], { breakdown: 'route', interval: 'hour' })],
      [
        'Failed or review-required payments',
        trend(['quotation_payment_failed', 'booking_payment_review', 'booking_verification_failed', 'quotation_verification_failed']),
      ],
      ['Quotation payment failures', trend(['quotation_payment_failed', 'quotation_verification_failed'])],
      [
        'Webhook failures and rejected signatures',
        trend([
          'booking_webhook_failed',
          'quotation_webhook_failed',
          'booking_webhook_rejected',
          'quotation_webhook_rejected',
        ]),
      ],
      [
        'Reconciliation recoveries',
        trend(['booking_reconciliation_recovered', 'quotation_reconciliation_recovered']),
      ],
      [
        'Not-found pageviews',
        trend([event('$pageview', [property('$pathname', '/404')])]),
      ],
    ],
  },
  {
    name: 'Portfolio / Performance',
    description: 'Anonymous Core Web Vitals emitted by the browser SDK.',
    insights: [
      ['Web vitals events', trend(['$web_vitals'])],
      ['p75 LCP by public route', trend([percentile('$web_vitals', '$web_vitals_LCP_value')], { breakdown: '$pathname' })],
      ['p75 INP by device', trend([percentile('$web_vitals', '$web_vitals_INP_value')], { breakdown: '$device_type' })],
      ['p75 CLS by public route', trend([percentile('$web_vitals', '$web_vitals_CLS_value')], { breakdown: '$pathname' })],
      ['p75 FCP by public route', trend([percentile('$web_vitals', '$web_vitals_FCP_value')], { breakdown: '$pathname' })],
      [
        'Slow LCP events',
        trend([event('$web_vitals', [property('$web_vitals_LCP_value', 4000, 'gt')])]),
      ],
      ['Pageviews by device', trend(['$pageview'], { breakdown: '$device_type' })],
    ],
  },
  {
    name: 'Portfolio / Delivery Operations',
    description: 'Receipt and invitation delivery outcomes, without /admin activity.',
    insights: [
      [
        'Quotation delivery activity',
        trend(['quotation_viewed', 'quotation_accepted', 'quotation_milestone_reviewed']),
      ],
      [
        'Milestone reviews by index',
        trend(['quotation_milestone_reviewed'], { breakdown: 'milestone_index' }),
      ],
      [
        'Milestone approval decisions',
        trend(['quotation_milestone_reviewed'], { breakdown: 'approved' }),
      ],
      [
        'Receipt delivery outcomes',
        trend(['receipt_delivery_succeeded', 'receipt_delivery_retry', 'receipt_delivery_exhausted']),
      ],
      [
        'Invitation delivery outcomes',
        trend(['invitation_delivery_succeeded', 'invitation_delivery_retry', 'invitation_delivery_exhausted']),
      ],
    ],
  },
  {
    name: 'Portfolio / Traffic & Engagement',
    description: 'Anonymous public-site traffic, friction and engagement. Watch recordings under Replay.',
    insights: [
      ['Pageviews by route', trend(['$pageview'], { breakdown: '$pathname' })],
      ['Pageviews by device', trend(['$pageview'], { breakdown: '$device_type' })],
      ['Pageviews by browser', trend(['$pageview'], { breakdown: '$browser' })],
      ['Unique sessions', trend([{ ...event('$pageview'), math: 'unique_session' }])],
      ['Average visit duration', trend([{ ...event('$pageleave'), math: 'avg', math_property: '$prev_pageview_duration' }])],
      ['Rage clicks by route', trend(['$rageclick'], { breakdown: '$pathname' })],
      ['Dead clicks by route', trend(['$dead_click'], { breakdown: '$pathname' })],
      ['Replay snapshots recorded', trend(['$snapshot'])],
      [
        'Visit to contact funnel',
        funnel(['$pageview', 'contact_submitted'], 60),
      ],
    ],
  },
  {
    name: 'Portfolio / Proposal Engagement',
    description: 'How clients interact with proposals, from opening the link to accepting it. No client identifiers.',
    insights: [
      ['Proposals opened', trend(['quotation_opened'])],
      ['Proposals loaded', trend(['quotation_viewed'])],
      ['Opened but never loaded', trend(['quotation_opened', 'quotation_viewed'], { display: 'ActionsLineGraph' })],
      ['Proposal downloads', trend(['quotation_downloaded'])],
      ['Proposal acceptances', trend(['quotation_accepted'])],
      ['Opened by device', trend(['quotation_opened'], { breakdown: '$device_type' })],
      ['Opened by route', trend(['quotation_opened'], { breakdown: '$pathname' })],
      [
        'Proposal engagement funnel',
        funnel(['quotation_opened', 'quotation_viewed', 'quotation_accepted'], 1440),
      ],
      [
        'Proposal to payment funnel',
        funnel(['quotation_opened', 'quotation_accepted', 'quotation_payment_checkout_opened', 'quotation_payment_confirmed'], 10080),
      ],
    ],
  },
];

export const alerts = [
  { dashboard: 'Portfolio / Reliability', insight: 'Browser exceptions', name: 'Browser exceptions detected', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Reliability', insight: 'Backend API errors', name: 'Backend API errors detected', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Reliability', insight: 'Failed or review-required payments', name: 'Payment journey requires attention', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Reliability', insight: 'Quotation payment failures', name: 'Quotation payment failures detected', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Reliability', insight: 'Webhook failures and rejected signatures', name: 'Payment webhook rejected or failed', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Reliability', insight: 'Reconciliation recoveries', name: 'Payment reconciliation recovered', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Booking Funnel', insight: 'Booking payment reviews', name: 'Booking payment review required', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Delivery Operations', insight: 'Receipt delivery outcomes', name: 'Receipt delivery exhausted', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Delivery Operations', insight: 'Invitation delivery outcomes', name: 'Invitation delivery exhausted', threshold: 0, condition: 'greater_than' },
  { dashboard: 'Portfolio / Performance', insight: 'Slow LCP events', name: 'Core Web Vitals LCP regression', threshold: 5, condition: 'greater_than' },
];

export const ALERT_NAMES = alerts.map((item) => item.name);
