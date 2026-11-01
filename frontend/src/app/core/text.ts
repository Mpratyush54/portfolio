export function pathOnly(url: string): string {
  const queryAt = url.indexOf('?');
  const hashAt = url.indexOf('#');
  let end = url.length;
  if (queryAt >= 0) end = Math.min(end, queryAt);
  if (hashAt >= 0) end = Math.min(end, hashAt);
  let path = url.slice(0, end);
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

export function withoutTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function isWhitespace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function isUrlStop(ch: string | undefined): boolean {
  return !ch || isWhitespace(ch) || ch === '"' || ch === "'" || ch === '<' || ch === '>';
}

function redactEmails(text: string): string {
  let result = '';
  let index = 0;
  while (index < text.length) {
    const at = text.indexOf('@', index);
    if (at < 0) {
      result += text.slice(index);
      break;
    }
    let start = at - 1;
    while (start >= index && !isWhitespace(text[start]) && text[start] !== '@') start--;
    start += 1;
    let end = at + 1;
    while (end < text.length && !isWhitespace(text[end]) && text[end] !== '@') end++;
    const candidate = text.slice(start, end);
    if (start < at && candidate.includes('.') && !candidate.includes(' ')) {
      result += text.slice(index, start) + '[redacted-email]';
      index = end;
    } else {
      result += text.slice(index, at + 1);
      index = at + 1;
    }
  }
  return result;
}

function redactUrls(text: string): string {
  let result = '';
  let index = 0;
  while (index < text.length) {
    const http = text.indexOf('http://', index);
    const https = text.indexOf('https://', index);
    let start = -1;
    if (http >= 0 && (https < 0 || http < https)) start = http;
    else if (https >= 0) start = https;
    if (start < 0) {
      result += text.slice(index);
      break;
    }
    let end = start;
    while (end < text.length && !isUrlStop(text[end])) end++;
    let replacement = '[redacted-url]';
    try {
      const parsed = new URL(text.slice(start, end));
      replacement = parsed.origin + parsed.pathname;
    } catch {
      /* Keep the placeholder when the URL is malformed. */
    }
    result += text.slice(index, start) + replacement;
    index = end;
  }
  return result;
}

export function redactPrivateText(value: string, maxLength = 4000): string {
  return redactUrls(redactEmails(value)).slice(0, maxLength);
}

function isHiddenControlChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code <= 8) return true;
  if (code === 0x0b || code === 0x0c) return true;
  if (code >= 0x0e && code <= 0x1f) return true;
  if (code === 0x7f) return true;
  if (code === 0xad || code === 0x061c) return true;
  if (code === 0x200b || code === 0x200e || code === 0x200f) return true;
  if (code >= 0x202a && code <= 0x202e) return true;
  if (code === 0x2060) return true;
  if (code >= 0x2066 && code <= 0x2069) return true;
  return code === 0xfeff || code === 0xfffd;
}

export function cleanVisibleText(value: string): string {
  const normalized = value.normalize('NFC');
  let result = '';
  for (let index = 0; index < normalized.length; index++) {
    const ch = normalized[index];
    if (ch === '\r') {
      if (normalized[index + 1] === '\n') index++;
      result += '\n';
      continue;
    }
    if (ch === '\u00a0') {
      result += ' ';
      continue;
    }
    if (isHiddenControlChar(ch)) continue;
    result += ch;
  }
  return result;
}
