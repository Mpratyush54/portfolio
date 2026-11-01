const { z } = require('zod');
const { httpError } = require('../shared/errors');
const { isMongoObjectId, looksLikeEmail, parseIsoDate } = require('../shared/text');

const SEARCH_FIELDS = ['name', 'email', 'clientName', 'clientEmail', 'title', 'company', 'assignedTo'];
const EMAIL_FIELDS = new Set(['email', 'clientEmail']);
const REGEX_SPECIALS = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);

const pageSchema = boundedDigits(1, 100000);
const pageSizeSchema = boundedDigits(1, 100);

function boundedDigits(min, max) {
  return z
    .string()
    .refine((text) => text.length > 0 && [...text].every((ch) => ch >= '0' && ch <= '9'))
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
}

function pageNumber(value, fallback, schema) {
  if (value === undefined) return fallback;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw httpError(400, 'Invalid pagination.');
  return parsed.data;
}

function escapeForMongoRegex(value) {
  let escaped = '';
  for (const ch of value) escaped += REGEX_SPECIALS.has(ch) ? `\\${ch}` : ch;
  return escaped;
}

function searchFilter(query, fields) {
  if (query.q === undefined) return {};
  if (typeof query.q !== 'string' || query.q.length > 120)
    throw httpError(400, 'Search must be at most 120 characters.');
  const text = query.q.trim();
  if (!text) return {};
  if (isMongoObjectId(text)) return { _id: text };
  const used = looksLikeEmail(text) ? fields.filter((field) => EMAIL_FIELDS.has(field)) : fields;
  const pattern = escapeForMongoRegex(text);
  return {
    $or: (used.length ? used : fields).map((field) => ({
      [field]: { $regex: pattern, $options: 'i' },
    })),
  };
}

function dateFilter(query, dateField) {
  const range = {};
  for (const key of ['from', 'to']) {
    if (!query[key]) continue;
    if (typeof query[key] !== 'string' || !parseIsoDate(query[key]))
      throw httpError(400, 'Invalid date range.');
    const start = key === 'from';
    range[start ? '$gte' : '$lte'] =
      dateField === 'date'
        ? query[key]
        : new Date(`${query[key]}T${start ? '00:00:00+05:30' : '23:59:59.999+05:30'}`);
  }
  if (query.from && query.to && query.from > query.to)
    throw httpError(400, 'Start date must precede end date.');
  return Object.keys(range).length ? { [dateField]: range } : {};
}

function options(query = {}, statuses = [], dateField = 'createdAt', searchFields = SEARCH_FIELDS) {
  const page = pageNumber(query.page, 1, pageSchema);
  const pageSize = pageNumber(query.pageSize, 25, pageSizeSchema);
  const filter = { ...searchFilter(query, searchFields), ...dateFilter(query, dateField) };
  if (query.status && query.status !== 'all') {
    if (!statuses.includes(query.status)) throw httpError(400, 'Invalid status.');
    filter.status = query.status;
  }
  return { filter, page, pageSize };
}

function findPage(Model, filter, sortField, select, skip, limit) {
  return Model.find(filter)
    .sort({ [sortField]: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .select(select)
    .lean();
}

async function page(
  Model,
  query,
  statuses,
  { dateField = 'createdAt', select = '-ip', sortField = 'createdAt', searchFields = SEARCH_FIELDS } = {},
) {
  const parsed = options(query, statuses, dateField, searchFields);
  const skip = (parsed.page - 1) * parsed.pageSize;
  const [total, rows] = await Promise.all([
    Model.countDocuments(parsed.filter),
    findPage(Model, parsed.filter, sortField, select, skip, parsed.pageSize),
  ]);
  const pages = Math.max(1, Math.ceil(total / parsed.pageSize));
  const currentPage = Math.min(parsed.page, pages);
  if (skip < total || parsed.page === 1)
    return { rows, total, page: currentPage, pageSize: parsed.pageSize, pages };
  return {
    rows: await findPage(
      Model,
      parsed.filter,
      sortField,
      select,
      (currentPage - 1) * parsed.pageSize,
      parsed.pageSize,
    ),
    total,
    page: currentPage,
    pageSize: parsed.pageSize,
    pages,
  };
}

module.exports = { options, page };
