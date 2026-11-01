#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { apiClient, environment, parseArgs } from './lib.mjs';
import { ALERT_NAMES, dashboards } from './manifest.mjs';
import { pathToFileURL } from 'node:url';

export const EXPECTED_EVENTS = [
  '$pageview',
  '$pageleave',
  '$exception',
  '$web_vitals',
  'booking_step_viewed',
  'booking_checkout_opened',
  'booking_confirmed',
  'booking_payment_review',
  'contact_submitted',
  'quotation_viewed',
  'quotation_accepted',
  'quotation_milestone_reviewed',
  'quotation_payment_checkout_opened',
  'quotation_payment_confirmed',
  'quotation_payment_failed',
  'quotation_payment_dismissed',
  'booking_order_created',
  'booking_verification_confirmed',
  'booking_webhook_accepted',
  'quotation_order_created',
  'quotation_verification_confirmed',
  'quotation_webhook_accepted',
  'receipt_delivery_succeeded',
  'invitation_delivery_succeeded',
  'api_error',
];

const SMOKE_EVENTS = [
  '$pageview',
  '$exception',
  '$web_vitals',
  'booking_checkout_opened',
  'quotation_payment_confirmed',
];

async function deploymentSmoke(deploymentUrl) {
  const base = new URL(deploymentUrl);
  const [pageResponse, configResponse] = await Promise.all([
    fetch(base),
    fetch(new URL('/runtime/analytics.json', base)),
  ]);
  if (!pageResponse.ok) throw new Error(`Deployment returned HTTP ${pageResponse.status}`);
  if (!configResponse.ok) throw new Error(`Runtime analytics config returned HTTP ${configResponse.status}`);
  const config = await configResponse.json();
  if (config.enabled !== true) throw new Error('Runtime analytics is not enabled');
  if (!/^phc_[A-Za-z0-9_-]+$/.test(config.projectToken || ''))
    throw new Error('Runtime analytics projectToken is missing or is not a public phc_ token');
  const html = await pageResponse.text();
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/gi)].map((match) =>
    new URL(match[1], base),
  );
  if (!scripts.length) throw new Error('No production JavaScript bundles were found in index.html');
  let injected = 0;
  for (const url of scripts) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Bundle ${url.pathname} returned HTTP ${response.status}`);
    if ((await response.text()).includes('//# chunkId=')) injected++;
    const mapResponse = await fetch(new URL(`${url.pathname}.map`, base), { redirect: 'manual' });
    if (mapResponse.status >= 200 && mapResponse.status < 300) {
      const mapBody = await mapResponse.text();
      if (/"(?:sources|mappings)"\s*:/.test(mapBody))
        throw new Error(`Source map is publicly deployed: ${url.pathname}.map`);
    }
  }
  if (!injected) throw new Error('Deployed bundles do not contain PostHog chunk metadata');
  return { bundlesChecked: scripts.length, bundlesWithChunkMetadata: injected };
}

export async function sendSmokeEvents({
  token = process.env.POSTHOG_PROJECT_TOKEN,
  ingestHost = process.env.POSTHOG_INGEST_HOST || 'https://us.i.posthog.com',
} = {}) {
  if (!token) throw new Error('Missing required environment variable: POSTHOG_PROJECT_TOKEN');
  const host = new URL(ingestHost);
  if (host.protocol !== 'https:' && host.hostname !== 'localhost')
    throw new Error('POSTHOG_INGEST_HOST must use HTTPS');
  const marker = randomUUID();
  for (const event of SMOKE_EVENTS) {
    const response = await fetch(new URL('/i/v0/e/', host), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: 'smoke:deployment',
        properties: {
          environment: 'test',
          smoke_marker: marker,
          $pathname: '/book',
          route: '/book',
        },
      }),
    });
    if (!response.ok)
      throw new Error(`Smoke capture ${event} failed (${response.status}): ${await response.text()}`);
  }
  return { marker, events: SMOKE_EVENTS };
}

async function waitForSmoke(api, marker, attempts = 8) {
  const quoted = SMOKE_EVENTS.map((name) => `'${name.replaceAll("'", "''")}'`).join(', ');
  for (let attempt = 0; attempt < attempts; attempt++) {
    const ingestion = await api.request('POST', '/query/', {
      query: {
        kind: 'HogQLQuery',
        query: `SELECT event, count() AS total FROM events WHERE timestamp >= now() - INTERVAL 15 MINUTE AND event IN (${quoted}) AND properties.smoke_marker = '${marker}' AND properties.environment = 'test' GROUP BY event`,
      },
    });
    const found = new Set((ingestion.results || []).map((row) => row[0]));
    if (SMOKE_EVENTS.every((event) => found.has(event))) return ingestion.results;
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error(`Smoke events with marker ${marker} were not ingested`);
}

export async function verify(options = {}) {
  const config = environment(options);
  if (options.dryRun) {
    return {
      dryRun: true,
      deployment: process.env.DEPLOYMENT_URL || null,
      expectedDashboards: dashboards.map((item) => item.name),
      expectedAlerts: ALERT_NAMES,
      ingestionEvents: EXPECTED_EVENTS,
      smokeEvents: options.smoke ? SMOKE_EVENTS : [],
    };
  }
  const deploymentUrl = process.env.DEPLOYMENT_URL;
  if (!deploymentUrl) throw new Error('Missing required environment variable: DEPLOYMENT_URL');
  const api = apiClient(config);
  const [remoteDashboards, remoteInsights, remoteAlerts, deployment] = await Promise.all([
    api.list('/dashboards/?limit=500'),
    api.list('/insights/?limit=500'),
    api.list('/alerts/?limit=500'),
    deploymentSmoke(deploymentUrl),
  ]);
  const missingDashboards = dashboards
    .map((item) => item.name)
    .filter((name) => !remoteDashboards.some((item) => item.name === name && !item.deleted));
  if (missingDashboards.length) throw new Error(`Missing managed dashboards: ${missingDashboards.join(', ')}`);

  const hours = Number.parseInt(process.env.POSTHOG_VERIFY_LOOKBACK_HOURS || '24', 10);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720)
    throw new Error('POSTHOG_VERIFY_LOOKBACK_HOURS must be an integer from 1 to 720');
  const quotedEvents = EXPECTED_EVENTS.map((name) => `'${name.replaceAll("'", "''")}'`).join(', ');
  const ingestion = await api.request('POST', '/query/', {
    query: {
      kind: 'HogQLQuery',
      query: `SELECT event, count() AS total, max(timestamp) AS latest FROM events WHERE timestamp >= now() - INTERVAL ${hours} HOUR AND event IN (${quotedEvents}) GROUP BY event ORDER BY total DESC`,
    },
  });
  if (!Array.isArray(ingestion.results) || ingestion.results.length === 0)
    throw new Error(`No allowlisted analytics events were ingested in the last ${hours} hours`);
  const smoke = options.smoke ? await sendSmokeEvents() : null;
  return {
    deployment,
    dashboards: remoteDashboards.filter((item) =>
      dashboards.some((definition) => definition.name === item.name),
    ).length,
    insights: remoteInsights.filter((item) => item.description?.includes('[managed:portfolio-posthog')).length,
    alerts: remoteAlerts.filter((item) => ALERT_NAMES.includes(item.name)).length,
    ingestion: ingestion.results,
    ...(smoke ? { smoke: { marker: smoke.marker, ingested: await waitForSmoke(api, smoke.marker) } } : {}),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await verify(options);
    console.log(options.json ? JSON.stringify(result, null, 2) : `PostHog verification passed: ${result.dashboards ?? 0} dashboards; ${result.ingestion?.length ?? 0} event types recently ingested.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
