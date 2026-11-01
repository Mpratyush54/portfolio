const { z } = require('zod');

const emailSchema = z.email();
const uuidSchema = z.uuid();
const uuidShapeSchema = z.guid();
const mongoIdSchema = z.hex().length(24);
const sha256Schema = z.hash('sha256');
const isoDateSchema = z.iso.date();
const digitsSchema = z.string().min(1).regex(/^\d+$/);
const gstinSchema = z.stringFormat(
  'gstin',
  /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
);
const distinctIdSchema = z.enum([
  'backend:anonymous',
  'backend:booking',
  'backend:quotation',
  'backend:http',
  'backend:delivery',
]);
const ipv4Schema = z.ipv4();
const hexGroupSchema = z.hex();

function prefixedIdSchema(prefix) {
  return z.templateLiteral([
    z.literal(`${prefix}_`),
    z.string().min(1).max(80).regex(/^[A-Za-z0-9]+$/),
  ]);
}

const providerSegmentSchema = z.union([
  prefixedIdSchema('order'),
  prefixedIdSchema('pay'),
]);

function looksLikeEmail(value) {
  return emailSchema.safeParse(value).success;
}

function isUuid(value, { requireVariant = true } = {}) {
  return (requireVariant ? uuidSchema : uuidShapeSchema).safeParse(value).success;
}

function isMongoObjectId(value) {
  if (value == null) return false;
  return mongoIdSchema.safeParse(typeof value === 'string' ? value : String(value)).success;
}

function isSha256Hex(value) {
  return sha256Schema.safeParse(value).success;
}

function isPrefixedId(value, prefix) {
  return prefixedIdSchema(prefix).safeParse(value).success;
}

function isBackendDistinctId(value) {
  return distinctIdSchema.safeParse(value).success;
}

function isGstin(value) {
  return gstinSchema.safeParse(value).success;
}

function parseIsoDate(value) {
  const text = String(value || '');
  if (!isoDateSchema.safeParse(text).success) return null;
  return {
    y: Number(text.slice(0, 4)),
    mo: Number(text.slice(5, 7)),
    d: Number(text.slice(8, 10)),
  };
}

function hideIdsInRoute(route) {
  return String(route).split('/').map((segment) => {
    if (!segment) return segment;
    if (mongoIdSchema.safeParse(segment).success) return ':id';
    if (uuidSchema.safeParse(segment).success) return ':uuid';
    if (digitsSchema.safeParse(segment).success) return ':number';
    if (providerSegmentSchema.safeParse(segment).success) return ':provider-id';
    return segment;
  }).join('/');
}

function isDottedIpv4(value) {
  return ipv4Schema.safeParse(value).success;
}

function unwrapIpv4Mapped(value) {
  const prefix = '::ffff:';
  if (!value.toLowerCase().startsWith(prefix)) return value;
  const rest = value.slice(prefix.length);
  return isDottedIpv4(rest) ? rest : value;
}

function ipv4FromMappedGroups(value) {
  const prefix = '::ffff:';
  if (!value.toLowerCase().startsWith(prefix)) return '';
  const groups = value.slice(prefix.length).split(':');
  if (
    groups.length !== 2 ||
    !hexGroupSchema.safeParse(groups[0]).success ||
    !hexGroupSchema.safeParse(groups[1]).success
  ) return '';
  const first = parseInt(groups[0], 16);
  const second = parseInt(groups[1], 16);
  return [first >> 8, first & 255, second >> 8, second & 255].join('.');
}

module.exports = {
  emailSchema,
  looksLikeEmail,
  isUuid,
  isMongoObjectId,
  isSha256Hex,
  isPrefixedId,
  isBackendDistinctId,
  isGstin,
  parseIsoDate,
  hideIdsInRoute,
  unwrapIpv4Mapped,
  ipv4FromMappedGroups,
};
