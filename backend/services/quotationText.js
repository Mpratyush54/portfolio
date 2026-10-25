// Preserve language characters, including ZWJ/ZWNJ used in Indic scripts.
function cleanText(value) {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff\ufffd]/g,
      '',
    );
}
function cleanEditor(value, depth = 0) {
  if (value instanceof Date) return new Date(value);
  if (depth > 10)
    throw Object.assign(new Error('Draft is too deeply nested.'), {
      status: 400,
    });
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map((v) => cleanEditor(v, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) => !['__proto__', 'prototype', 'constructor'].includes(key),
        )
        .map(([key, v]) => [key, cleanEditor(v, depth + 1)]),
    );
  return value;
}
module.exports = { cleanText, cleanEditor };
