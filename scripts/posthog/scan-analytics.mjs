#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FORBIDDEN_NAMES = new Set([
  'email',
  'e-mail',
  'name',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'full_name',
  'fullname',
  'id',
  'raw_id',
  'token',
  'amount',
  'body',
  'header',
  'headers',
]);
const ALLOWED_NAMES = new Set([
  'correlation_id',
  'event_source',
  'milestone_index',
  'payment_kind',
  'distinct_id',
  '$device_id',
  '$session_id',
  '$window_id',
  '$insert_id',
]);
const CALL_OWNERS = new Set(['posthog', 'client', 'sdk', 'analytics']);
const CALL_METHODS = ['captureException', 'capture'];

function isNameChar(ch) {
  return (
    (ch >= '0' && ch <= '9') ||
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    ch === '_' ||
    ch === '$' ||
    ch === '-'
  );
}

function isForbiddenProperty(name) {
  const key = name.toLowerCase();
  if (ALLOWED_NAMES.has(key)) return false;
  if (FORBIDDEN_NAMES.has(key)) return true;
  return key.endsWith('_id') || key.endsWith('_token') || key.endsWith('_amount');
}

function closingParen(source, start) {
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '/' && next === '/') {
      index = source.indexOf('\n', index);
      if (index < 0) return source.length;
    } else if (char === '/' && next === '*') {
      index = source.indexOf('*/', index + 2);
      if (index < 0) return source.length;
      index++;
    } else if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return index;
  }
  return source.length;
}

function ownerBefore(source, index) {
  let end = index;
  while (end > 0 && (source[end - 1] === '?' || source[end - 1] === '.')) end--;
  let start = end;
  while (start > 0 && isNameChar(source[start - 1])) start--;
  return source.slice(start, end);
}

function findCaptureCalls(source) {
  const calls = [];
  for (const method of CALL_METHODS) {
    for (const needle of [`.${method}(`, `?.${method}(`]) {
      let from = 0;
      while (from < source.length) {
        const index = source.indexOf(needle, from);
        if (index < 0) break;
        from = index + needle.length;
        const owner = ownerBefore(source, index);
        if (!CALL_OWNERS.has(owner)) continue;
        const end = closingParen(source, from);
        const start = index - owner.length;
        calls.push({
          start,
          end,
          text: source.slice(start, end + 1),
        });
      }
    }
  }
  return calls;
}

function objectKeysInCall(call) {
  const keys = [];
  let quote = null;
  let escaped = false;
  for (let index = 0; index < call.length; index++) {
    const char = call[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char !== ':') continue;
    let end = index - 1;
    while (end >= 0 && (call[end] === ' ' || call[end] === '\n' || call[end] === '\t' || call[end] === '\r'))
      end--;
    if (end < 0) continue;
    if (call[end] === '"' || call[end] === "'") {
      const mark = call[end];
      let start = end - 1;
      while (start >= 0 && call[start] !== mark) start--;
      if (start >= 0) keys.push({ name: call.slice(start + 1, end), index: start });
      continue;
    }
    let start = end;
    while (start >= 0 && isNameChar(call[start])) start--;
    const name = call.slice(start + 1, end + 1);
    if (name) keys.push({ name, index: start + 1 });
  }
  return keys;
}

export function scanText(source, file = '<text>') {
  const findings = [];
  for (const call of findCaptureCalls(source)) {
    for (const property of objectKeysInCall(call.text)) {
      if (!isForbiddenProperty(property.name)) continue;
      const offset = call.start + property.index;
      const line = source.slice(0, offset).split('\n').length;
      findings.push({ file, line, property: property.name });
    }
  }
  return findings;
}

async function sourceFiles(directory, extensions) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '_archive' || entry.name === 'node_modules' || entry.name === 'test') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path, extensions)));
    else if (
      extensions.includes(extname(entry.name)) &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.js')
    )
      files.push(path);
  }
  return files;
}

export async function scanRepository(root) {
  const findings = [];
  const targets = [
    [join(root, 'frontend', 'src'), ['.ts']],
    [join(root, 'backend', 'modules'), ['.js']],
  ];
  for (const [base, extensions] of targets)
    for (const file of await sourceFiles(base, extensions))
      findings.push(...scanText(await readFile(file, 'utf8'), relative(root, file)));
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const findings = await scanRepository(root);
  if (findings.length) {
    for (const finding of findings)
      console.error(`${finding.file}:${finding.line}: forbidden analytics property "${finding.property}"`);
    process.exitCode = 1;
  } else {
    console.log('Analytics property scan passed.');
  }
}
