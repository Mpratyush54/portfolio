const { httpError } = require('./bookingValidation');
function options(query = {}, statuses = [], dateField = 'createdAt') {
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || +value < 1 || +value > max)
      throw httpError(400, 'Invalid pagination.');
    return +value;
  };
  const page = number(query.page, 1, 100000), pageSize = number(query.pageSize, 25, 100);
  const filter = {};
  if (query.status && query.status !== 'all') {
    if (!statuses.includes(query.status)) throw httpError(400, 'Invalid status.');
    filter.status = query.status;
  }
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 120))
    throw httpError(400, 'Search must be at most 120 characters.');
  const search = (query.q || '').trim();
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'email', 'clientName', 'clientEmail', 'title', 'company', 'assignedTo']
      .map(field => ({ [field]: { $regex: literal, $options: 'i' } }));
    if (/^[a-f\d]{24}$/i.test(search)) filter.$or.push({ _id: search });
  }
  for (const key of ['from', 'to']) {
    if (!query[key]) continue;
    if (typeof query[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(query[key]) ||
        !Number.isFinite(new Date(query[key]).getTime()) || new Date(query[key]).toISOString().slice(0, 10) !== query[key])
      throw httpError(400, 'Invalid date range.');
    filter[dateField] ||= {};
    filter[dateField][key === 'from' ? '$gte' : '$lte'] = dateField === 'date'
      ? query[key] : new Date(query[key] + (key === 'from' ? 'T00:00:00+05:30' : 'T23:59:59.999+05:30'));
  }
  if (query.from && query.to && query.from > query.to) throw httpError(400, 'Start date must precede end date.');
  return { filter, page, pageSize, skip: (page - 1) * pageSize };
}
async function page(Model, query, statuses, { dateField = 'createdAt', select = '-ip', sortField = 'createdAt' } = {}) {
  const o = options(query, statuses, dateField);
  const total = await Model.countDocuments(o.filter);
  const pages = Math.max(1, Math.ceil(total / o.pageSize));
  o.page = Math.min(o.page, pages);
  const rows = await Model.find(o.filter).sort({ [sortField]: -1, _id: -1 })
    .skip((o.page - 1) * o.pageSize).limit(o.pageSize).select(select).lean();
  return { rows, total, page: o.page, pageSize: o.pageSize, pages };
}
module.exports = { options, page };
