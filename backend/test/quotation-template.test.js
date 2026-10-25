const { test } = require('node:test');
const assert = require('node:assert/strict');
const template = require('../services/quotationTemplate');
const { validate } = require('../services/quotationService');
function validBuilder() {
  const b = template.defaults();
  Object.assign(b.provider, {
    name: 'Example Provider',
    email: 'provider@example.com',
    address: 'Example street, Bengaluru, India',
    taxStatus: 'not_registered',
    venue: 'Bengaluru, Karnataka',
  });
  b.scopeNotes =
    'Home and Contact pages; booking flow; approve after all listed forms work on mobile and desktop.';
  return b;
}
test('generates complete quotation fields and all 16 agreement sections from selections', () => {
  const b = validBuilder();
  b.features.push('booking');
  b.reviewDays = 7;
  b.revisionRounds = 3;
  b.weeks = 6;
  const result = template.compile(b);
  assert.equal(result.builder.clauses.length, 16);
  assert.match(result.scope, /duplicate reservations/);
  assert.match(result.exclusions, /3 consolidated round/);
  assert.match(result.timeline, /6 week/);
  assert.match(result.terms, /within 7 business days/);
  assert.match(result.terms, /30 calendar days/);
  assert.match(result.terms, /provider@example.com/);
  assert.match(result.terms, /Bengaluru, Karnataka/);
  assert.doesNotMatch(result.terms, /\{\{/);
  assert.ok(result.terms.length > 10000 && result.terms.length <= 14000);
});
test('server generates authoritative agreement text instead of trusting stale client prose', () => {
  const q = validate({
    title: 'Project',
    clientName: 'Client',
    clientEmail: 'client@example.com',
    totalPaise: 100000,
    validUntil: new Date(Date.now() + 86400000),
    builder: validBuilder(),
    seller: 'Forged provider',
    terms: 'No refunds, no support',
    scope: 'Unquoted extra work',
    exclusions: 'none',
    timeline: 'tomorrow',
  });
  assert.match(q.seller, /Example Provider/);
  assert.match(q.terms, /unused advances/);
  assert.match(q.terms, /30 calendar days/);
  assert.doesNotMatch(q.terms, /No refunds/);
  assert.doesNotMatch(q.scope, /Unquoted extra/);
});
test('captures explicit clause edits and portfolio permission in final accepted prose', () => {
  const b = validBuilder();
  b.portfolio = true;
  b.additionalTerms = 'Two recorded handover sessions are included.';
  b.clauses.find((c) => c.id === 'review').text +=
    ' A joint review call is included.';
  const q = template.compile(b);
  assert.match(q.terms, /joint review call/);
  assert.match(q.terms, /Two recorded handover/);
  assert.match(q.terms, /permits the provider to identify/);
  assert.doesNotMatch(
    template.compile(validBuilder()).terms,
    /permits the provider to identify/,
  );
});
test('rejects missing contract sections, unknown/duplicate choices and unresolved placeholders', () => {
  const b = validBuilder();
  b.clauses.pop();
  assert.throws(
    () => template.compile(b),
    (e) => e.status === 400,
  );
  const malformed = validBuilder();
  malformed.clauses[0] = null;
  assert.throws(() => template.compile(malformed), e => e.status === 400);
  const c = validBuilder();
  c.features.push('invented');
  assert.throws(
    () => template.compile(c),
    (e) => e.status === 400,
  );
  const d = validBuilder();
  d.exclusions.push(d.exclusions[0]);
  assert.throws(
    () => template.compile(d),
    (e) => e.status === 400,
  );
  const e = validBuilder();
  e.clauses[0].text += ' {{unknown}}';
  assert.throws(
    () => template.compile(e),
    (e) => e.status === 400,
  );
});
test('requires real provider fields, chosen tax status and project-specific acceptance criteria', () => {
  for (const key of ['name', 'email', 'address', 'venue', 'taxStatus']) {
    const b = validBuilder();
    b.provider[key] = '';
    assert.throws(
      () => template.compile(b),
      (e) => e.status === 400,
    );
  }
  const b = validBuilder();
  b.scopeNotes = '';
  assert.throws(
    () => template.compile(b),
    (e) => e.status === 400,
  );
  const c = validBuilder();
  c.provider.taxStatus = 'registered';
  assert.throws(
    () => template.compile(c),
    (e) => e.status === 400,
  );
  c.provider.gstin = '29ABCDE1234F1Z5';
  c.provider.taxNote = 'Applicable GST is included in the final total.';
  assert.match(template.compile(c).seller, /29ABCDE1234F1Z5/);
});
test('keeps default choices independent between clients and restricts numeric options', () => {
  const first = validBuilder();
  first.clauses[0].text = 'Custom';
  first.features.length = 0;
  assert.notEqual(template.defaults().clauses[0].text, 'Custom');
  assert.ok(template.defaults().features.length);
  for (const [key, value] of [
    ['weeks', 0],
    ['reviewDays', 31],
    ['revisionRounds', 2.5],
  ]) {
    const b = validBuilder();
    b[key] = value;
    assert.throws(
      () => template.compile(b),
      (e) => e.status === 400,
    );
  }
});
