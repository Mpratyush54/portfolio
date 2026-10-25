const crypto = require('crypto');
const mongoose = require('mongoose');
const { pipeline } = require('stream/promises');
const { unzipSync, strFromU8 } = require('fflate');
const { httpError } = require('./bookingValidation');
const { cleanText } = require('./quotationText');
const MAX_FILE = 5 * 1024 * 1024;
function inspectFile(buffer, filename) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE)
    throw httpError(400, 'Choose a non-empty file up to 5 MB.');
  const name = cleanText(String(filename || ''))
    .replace(/[\\/\r\n\x00-\x1f]/g, '_')
    .trim();
  if (!name || name.length > 180)
    throw httpError(400, 'Use a filename up to 180 characters.');
  const ext = name.split('.').pop().toLowerCase();
  let mime;
  if (ext === 'pdf') {
    if (
      buffer.subarray(0, 5).toString() !== '%PDF-' ||
      !buffer.subarray(-2048).includes(Buffer.from('%%EOF'))
    )
      throw httpError(400, 'This is not a valid PDF file.');
    mime = 'application/pdf';
  } else if (ext === 'docx') {
    try {
      let expanded = 0,
        entries = 0;
      const content = unzipSync(buffer, {
        filter(file) {
          expanded += file.originalSize;
          entries++;
          if (
            expanded > 30 * 1024 * 1024 ||
            entries > 2000 ||
            /(^|\/)\.\.(\/|$)|vbaProject|activeX/i.test(file.name)
          )
            throw new Error('Unsupported archive.');
          return ['[Content_Types].xml', 'word/document.xml'].includes(
            file.name,
          );
        },
      });
      if (
        !content['word/document.xml'] ||
        !content['[Content_Types].xml'] ||
        !strFromU8(content['word/document.xml']).includes(':document') ||
        !strFromU8(content['[Content_Types].xml']).includes(
          'wordprocessingml.document.main+xml',
        )
      )
        throw new Error('Not DOCX.');
    } catch {
      throw httpError(
        400,
        'Choose a valid DOCX without macros or embedded active components.',
      );
    }
    mime =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else throw httpError(400, 'SRS attachments must be PDF or DOCX.');
  return {
    name,
    mime,
    size: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}
const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'quotationSrs',
  });
function disposition(name) {
  return `attachment; filename="document.${name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))}`;
}
function createQuotationFiles(service) {
  async function upload(id, version, filename, buffer) {
    const q = await service.get(id);
    if (q.status !== 'draft' || q.__v !== Number(version))
      throw httpError(
        409,
        'Reload the current draft before changing SRS attachments.',
      );
    if (q.srs.length >= 3)
      throw httpError(400, 'A quotation can have up to three SRS attachments.');
    const meta = inspectFile(buffer, filename);
    if (q.srs.some((s) => s.sha256 === meta.sha256))
      throw httpError(409, 'This SRS file is already attached.');
    const store = bucket(),
      stream = store.openUploadStream(meta.name, {
        metadata: { quotationId: q.id, sha256: meta.sha256, mime: meta.mime },
      });
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      stream.end(buffer);
    });
    q.srs.push({ ...meta, fileId: stream.id, uploadedAt: new Date() });
    try {
      await q.save();
    } catch (error) {
      await store.delete(stream.id).catch(() => {});
      if (error.name === 'VersionError')
        throw httpError(
          409,
          'Draft changed while uploading. Reload and try again.',
        );
      throw error;
    }
    return service.view(q, true);
  }
  async function remove(id, fileId, version) {
    const q = await service.get(id);
    if (q.status !== 'draft' || q.__v !== Number(version))
      throw httpError(
        409,
        'Reload the current draft before changing SRS attachments.',
      );
    const file = q.srs.find((s) => String(s.fileId) === fileId);
    if (!file) throw httpError(404, 'SRS attachment not found.');
    q.srs = q.srs.filter((s) => String(s.fileId) !== fileId);
    try {
      await q.save();
    } catch (error) {
      if (error.name === 'VersionError')
        throw httpError(
          409,
          'Draft changed. Reload before removing this file.',
        );
      throw error;
    }
    // Other revisions can still refer to these immutable bytes.
    const Quote = require('../models/Quotation');
    if (!(await Quote.exists({ 'srs.fileId': file.fileId })))
      await bucket()
        .delete(file.fileId)
        .catch(() => {});
    return service.view(q, true);
  }
  async function download(q, id, res) {
    const file = q.srs.find((s) => String(s.fileId) === id);
    if (!file) throw httpError(404, 'SRS attachment not found.');
    const store = bucket();
    if (!(await store.find({ _id: file.fileId }).hasNext()))
      throw httpError(404, 'SRS bytes are unavailable.');
    res.set({
      'Content-Type': file.mime,
      'Content-Disposition': disposition(file.name),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Content-Length': String(file.size),
    });
    await pipeline(store.openDownloadStream(file.fileId), res);
  }
  return { upload, remove, download };
}
module.exports = { createQuotationFiles, inspectFile, disposition, MAX_FILE };
