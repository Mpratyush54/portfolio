const schemas = require('./schemas');

function isHiddenControlChar(ch) {
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

function cleanVisibleText(value) {
  const normalized = String(value).normalize('NFC');
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

function sanitizeFilename(name) {
  let result = '';
  for (const ch of name) {
    const code = ch.charCodeAt(0);
    if (ch === '\\' || ch === '/' || ch === '\r' || ch === '\n' || code <= 0x1f)
      result += '_';
    else result += ch;
  }
  return result.trim();
}

function isUnsafeArchivePath(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('vbaproject') || lower.includes('activex')) return true;
  return String(name || '').split('/').includes('..');
}

module.exports = {
  ...schemas,
  cleanVisibleText,
  sanitizeFilename,
  isUnsafeArchivePath,
};
