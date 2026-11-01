#!/usr/bin/env node
import { apiClient, environment, parseArgs } from './lib.mjs';
import { alerts, dashboards, MANAGED_MARKER } from './manifest.mjs';
import { pathToFileURL } from 'node:url';

export async function bootstrap(options = {}) {
  const config = environment(options);
  const api = apiClient(config, options);
  const existingDashboards = await api.list('/dashboards/?limit=500');
  const existingInsights = await api.list('/insights/?limit=500');
  const existingAlerts = await api.list('/alerts/?limit=500');
  const dashboardIds = new Map();
  const insightIds = new Map();
  const result = { dashboards: [], insights: [], alerts: [] };

  for (const definition of dashboards) {
    const found = existingDashboards.find((item) => item.name === definition.name && !item.deleted);
    const payload = {
      name: definition.name,
      description: `${MANAGED_MARKER} ${definition.description}`,
      tags: ['portfolio', 'managed'],
      pinned: definition.name === 'Portfolio / Executive',
    };
    const saved = options.dryRun
      ? { id: `dry-dashboard-${dashboardIds.size + 1}` }
      : await api.request(found ? 'PATCH' : 'POST', found ? `/dashboards/${found.id}/` : '/dashboards/', payload);
    const id = found?.id || saved.id;
    dashboardIds.set(definition.name, id);
    result.dashboards.push({ action: found ? 'updated' : 'created', name: definition.name, id });
  }

  for (const dashboard of dashboards) {
    const dashboardId = dashboardIds.get(dashboard.name);
    for (const [title, query] of dashboard.insights) {
      const name = `${dashboard.name} / ${title}`;
      const found = existingInsights.find((item) => item.name === name && !item.deleted);
      const payload = {
        name,
        description: `${MANAGED_MARKER} ${title}`,
        query,
        dashboards: [dashboardId],
        tags: ['portfolio', 'managed'],
      };
      const saved = options.dryRun
        ? { id: `dry-insight-${insightIds.size + 1}` }
        : await api.request(found ? 'PATCH' : 'POST', found ? `/insights/${found.id}/` : '/insights/', payload);
      const id = found?.id || saved.id;
      insightIds.set(`${dashboard.name}\0${title}`, id);
      result.insights.push({ action: found ? 'updated' : 'created', name, id });
    }
  }

  for (const definition of alerts) {
    const insight = insightIds.get(`${definition.dashboard}\0${definition.insight}`);
    if (!insight) throw new Error(`Alert "${definition.name}" references an unknown insight`);
    const found = existingAlerts.find((item) => item.name === definition.name);
    const payload = {
      insight,
      name: definition.name,
      subscribed_users: [],
      threshold: definition.threshold,
      condition: definition.condition,
      enabled: true,
    };
    try {
      const saved = options.dryRun
        ? { id: `dry-alert-${result.alerts.length + 1}` }
        : await api.request(found ? 'PATCH' : 'POST', found ? `/alerts/${found.id}/` : '/alerts/', payload);
      result.alerts.push({
        action: found ? 'updated' : 'created',
        name: definition.name,
        id: found?.id || saved.id,
      });
    } catch (error) {
      throw new Error(
        `Alert bootstrap failed for "${definition.name}". Confirm alert:write scope and plan support; the API did not accept the documented /alerts/ payload. ${error.message}`,
      );
    }
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await bootstrap(options);
    console.log(options.json ? JSON.stringify(result, null, 2) : `PostHog bootstrap complete: ${result.dashboards.length} dashboards, ${result.insights.length} insights, ${result.alerts.length} alerts.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
