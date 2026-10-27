const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { unzipSync, zipSync, strToU8, strFromU8 } = require('fflate');
const { PDFParse } = require('pdf-parse');
const Quote = require('../models/Quotation');
const { createQuotationService } = require('../services/quotationService');
const { createQuotationRouter } = require('../services/quotationRoutes');
const { exportQuotation, sections } = require('../services/quotationExport');
const { inspectFile } = require('../services/quotationFiles');
const { defaults } = require('../services/quotationTemplate');
const { cleanText } = require('../services/quotationText');

function editor() {
  const builder = defaults();
  Object.assign(builder.provider, {
    name: 'Example Provider',
    email: 'provider@example.com',
    address: 'Example street, Bengaluru, India',
    venue: 'Bengaluru, Karnataka',
    taxStatus: 'not_registered',
  });
  builder.scopeNotes =
    'Home and Contact pages, working contact form and booking flow on mobile and desktop.';
  return {
    title: 'Website project quotation',
    clientName: 'Example Client',
    clientEmail: 'client@example.com',
    builder,
    totalRupees: 10000.03,
    validDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  };
}
const draft = (value = editor()) => ({
  clientDraftId: crypto.randomUUID(),
  mutationId: crypto.randomUUID(),
  editor: value,
});
describe('Durable quotation drafts, SRS files and document exports', () => {
  let mongo, service, server, origin, pdf, word;
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Quote.init();
    service = createQuotationService({ gateway: () => null });
    const app = express();
    app.use(express.json({ limit: '48kb' }));
    app.use(
      '/api',
      createQuotationRouter(service, (req, res, next) =>
        req.get('x-admin-password') === 'test' ? next() : res.sendStatus(401),
      ),
    );
    app.use((e, req, res, next) =>
      res.status(e.status || 500).json({ error: e.message }),
    );
    server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    origin = `http://127.0.0.1:${server.address().port}/api`;
    const q = await service.saveDraft(draft());
    pdf = (await exportQuotation(q, 'pdf')).buffer;
    word = (await exportQuotation(q, 'docx')).buffer;
  });
  after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongo.stop();
  });
  beforeEach(async () => {
    await Quote.deleteMany({});
  });
  it('protects collection changes with admin authentication, even for a valid client invite', async () => {
    const q = await service.saveDraft(draft());
    const invitation = await service.invite(q._id, q.__v);
    const response = await fetch(origin + `/admin/quotations/${q._id}/collection/0`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-quotation-token': invitation.token },
      body: JSON.stringify({ version: 1, amountPaise: 500000, reason: 'Client supplied amount' }),
    });
    assert.equal(response.status, 401);
    assert.equal((await service.get(q._id)).milestones[0].collectionPaise, undefined);
  });
  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    return fetch(origin + path, {
      method,
      headers: {
        'x-admin-password': 'test',
        ...(body && !Buffer.isBuffer(body)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...headers,
      },
      body: body
        ? Buffer.isBuffer(body)
          ? body
          : JSON.stringify(body)
        : undefined,
    });
  }
  async function upload(q, bytes = pdf, name = 'Requirements.pdf') {
    const res = await request(`/admin/quotations/${q._id}/srs`, {
      method: 'POST',
      body: bytes,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-file-name': encodeURIComponent(name),
        'x-quote-version': String(q.__v),
      },
    });
    assert.equal(res.status, 200, await res.clone().text());
    return res.json();
  }
  it('saves incomplete drafts, restores text, and makes retries idempotent', async () => {
    const payload = draft({
      title: 'Partial\u200b title\ufffd',
      totalRupees: 0,
    });
    const q = await service.saveDraft(payload);
    assert.equal(q.draftReady, false);
    assert.ok(q.draftValidation);
    assert.equal(q.draftEditor.title, 'Partial title');
    assert.equal(String((await service.saveDraft(payload))._id), String(q._id));
    assert.equal(await Quote.countDocuments(), 1);
    assert.equal((await service.list())[0].draftEditor.title, 'Partial title');
    await assert.rejects(service.invite(q._id, q.__v), (e) => e.status === 409);
    await assert.rejects(exportQuotation(q, 'pdf'), (e) => e.status === 409);
    const complete = await service.saveDraft({
      ...payload,
      id: q._id,
      version: q.__v,
      mutationId: crypto.randomUUID(),
      editor: editor(),
    });
    assert.equal(complete.draftReady, true);
    assert.equal(complete.totalPaise, 1000003);
    assert.equal(complete.draftValidation, undefined);
    await assert.rejects(
      service.saveDraft({
        ...payload,
        id: q._id,
        version: q.__v,
        mutationId: crypto.randomUUID(),
      }),
      (e) => e.status === 409,
    );
  });
  it('keeps draft creation idempotent under concurrent requests', async () => {
    const payload = draft({ title: 'Concurrent' });
    const results = await Promise.all([
      service.saveDraft(payload),
      service.saveDraft(payload),
    ]);
    assert.equal(String(results[0]._id), String(results[1]._id));
    assert.equal(await Quote.countDocuments(), 1);
  });
  it('strips hidden formatting while preserving Indic shaping and line breaks', () => {
    assert.equal(
      cleanText('a\u00a0b\u200b\u202ec\nक्\u200dष\ufffd'),
      'a bc\nक्\u200dष',
    );
  });
  it('stores exact SRS bytes durably, binds their digest, restricts downloads and freezes invited attachments', async () => {
    let q = await service.saveDraft(draft());
    const previousDigest = q.digest;
    q = await upload(q, word, 'Requirements.docx');
    assert.notEqual(q.digest, previousDigest);
    const fileId = q.srs[0].fileId;
    let response = await request(`/admin/quotations/${q._id}/srs/${fileId}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), word);
    response = await request(`/admin/quotations/${q._id}/srs/${fileId}`, {
      headers: { 'x-admin-password': '' },
    });
    assert.equal(response.status, 401);
    const other = await service.saveDraft(draft());
    const inviteOther = await service.invite(other._id, other.__v);
    response = await request(`/quotations/srs/${fileId}`, {
      headers: { 'x-quotation-token': inviteOther.token },
    });
    assert.equal(response.status, 404);
    const invite = await service.invite(q._id, q.__v);
    response = await request(`/quotations/srs/${fileId}`, {
      headers: { 'x-quotation-token': invite.token },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /^attachment;/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), word);
    response = await request(`/admin/quotations/${q._id}/srs/${fileId}`, {
      method: 'DELETE',
      body: { version: q.__v + 1 },
    });
    assert.equal(response.status, 409);
    await assert.rejects(
      service.saveDraft({ ...draft(), id: q._id, version: q.__v + 1 }),
      (e) => e.status === 409,
    );
    const revised = await service.revise(q._id);
    response = await request(`/admin/quotations/${revised._id}/srs/${fileId}`, {
      method: 'DELETE',
      body: { version: revised.__v },
    });
    assert.equal(response.status, 200);
    // The frozen historical revision still owns its bytes.
    response = await request(`/admin/quotations/${q._id}/srs/${fileId}`);
    assert.equal(response.status, 200);
  });
  it('rejects disguised, oversized, active and duplicate files and stale upload versions', async () => {
    assert.throws(
      () => inspectFile(Buffer.from('invalid'), 'srs.pdf'),
      (e) => e.status === 400,
    );
    assert.throws(
      () => inspectFile(Buffer.alloc(5 * 1024 * 1024 + 1), 'srs.pdf'),
      (e) => e.status === 400,
    );
    const active = zipSync({
      ...unzipSync(word),
      'word/vbaProject.bin': strToU8('macro'),
    });
    assert.throws(
      () => inspectFile(active, 'srs.docx'),
      (e) => e.status === 400,
    );
    let q = await service.saveDraft(draft());
    const stale = q.__v;
    q = await upload(q);
    const path = `/admin/quotations/${q._id}/srs`;
    const headers = {
      'Content-Type': 'application/octet-stream',
      'x-file-name': 'again.pdf',
      'x-quote-version': String(q.__v),
    };
    assert.equal(
      (await request(path, { method: 'POST', headers, body: pdf })).status,
      409,
    );
    assert.equal(
      (
        await request(path, {
          method: 'POST',
          headers: { ...headers, 'x-quote-version': String(stale) },
          body: word,
        })
      ).status,
      409,
    );
  });
  it('exports the complete canonical agreement and SRS references to PDF and Word with private access', async () => {
    let q = await service.saveDraft(draft());
    q = await upload(q);
    const parsed = new PDFParse({
      data: (await exportQuotation(q, 'pdf')).buffer,
    });
    const text = (await parsed.getText()).text;
    await parsed.destroy();
    assert.match(text, /Website project quotation/);
    assert.match(text, /Requirements.pdf/);
    assert.match(text, /30 calendar days/);
    assert.match(text, /10,000.03/);
    const doc = unzipSync((await exportQuotation(q, 'docx')).buffer);
    const xml = strFromU8(doc['word/document.xml']);
    assert.match(xml, /Requirements.pdf/);
    assert.match(xml, /30 calendar days/);
    assert.match(xml, /Scope and acceptance criteria/);
    const invite = await service.invite(q._id, q.__v);
    assert.equal((await request('/quotations/export/pdf')).status, 404);
    const response = await request('/quotations/export/docx', {
      headers: { 'x-quotation-token': invite.token },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /wordprocessingml/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const loaded = await service.portal(invite.token);
    assert.equal(service.view(loaded).draftEditor, undefined);
  });
  it('preserves clause paragraphs and the quotation snapshot while formatting exports', async () => {
    const value = editor();
    value.builder.clauses[0].text += '\n\nA separately agreed second paragraph stays in this clause.';
    const q = await service.saveDraft(draft(value));
    const before = JSON.stringify(q);
    const clauses = sections(q).filter((s) => s.agreement);
    assert.equal(clauses.length, 16);
    assert.match(clauses[0].text, /\n\nA separately agreed second paragraph/);
    for (const format of ['pdf', 'docx']) await exportQuotation(q, format);
    assert.equal(JSON.stringify(q), before);
  });
});
