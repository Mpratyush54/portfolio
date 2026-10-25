const path = require('path');
const PDFDocument = require('pdfkit');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Footer,
  PageNumber,
  AlignmentType,
} = require('docx');
const { cleanText } = require('./quotationText');
const { httpError } = require('./bookingValidation');
const money = (value) =>
  `INR ${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function sections(q) {
  const result = [
    {
      title: 'Quotation summary',
      text: `Prepared for ${q.clientName}\nClient email: ${q.clientEmail}\nRevision: ${q.revision} | Status: ${q.status}\nValid until: ${new Date(q.validUntil).toISOString().slice(0, 10)}\nFinal payable total: ${money(q.totalPaise)}\nThis quotation describes the agreed project scope, delivery phases, commercial terms and acceptance record.`,
    },
    { title: 'Provider', text: q.seller },
    { title: 'Scope and acceptance criteria', text: q.scope },
    { title: 'Exclusions and revision limits', text: q.exclusions },
    { title: 'Timeline and client responsibilities', text: q.timeline },
    {
      title: 'Milestone payments',
      text: q.milestones
        .map(
          (m, i) =>
            `${i + 1}. ${m.label}: ${m.percent}% - ${money(m.amountPaise)}${m.paidAt ? ' | Captured ' + new Date(m.paidAt).toISOString() : ''}`,
        )
        .join('\n'),
    },
    {
      title: 'SRS requirements documents',
      text: q.srs?.length
        ? q.srs
            .map(
              (s) => `${s.name}\nSize: ${s.size} bytes\nSHA-256: ${s.sha256}`,
            )
            .join('\n\n') +
          '\n\nThe listed SRS files are part of this quotation revision. Original files can be downloaded separately from the private portal.'
        : 'No SRS attachments are included in this revision.',
    },
  ];
  q.terms.split(/\n\n+/).forEach((part, i) => {
    const lines = part.split('\n');
    if (lines.length > 1 && /^\d+\.\s/.test(lines[0]))
      result.push({
        title: lines.shift().replace(/^\d+\.\s*/, ''),
        text: lines.join('\n'),
      });
    else result.push({ title: i === 0 ? 'Agreement terms' : '', text: part });
  });
  if (q.acceptance?.at)
    result.push({
      title: 'Recorded acceptance',
      text: `${q.acceptance.name}\n${q.acceptance.email}\nAccepted: ${new Date(q.acceptance.at).toISOString()}\nAgreement SHA-256: ${q.acceptance.digest}\nThis is the recorded portal acceptance, not a certified digital signature.`,
    });
  else
    result.push({
      title: 'Acceptance status',
      text: 'This quotation has not been accepted. A draft export is not a record of client agreement.',
    });
  if (q.deployedAt)
    result.push({
      title: 'Support window',
      text: `Production deployment: ${new Date(q.deployedAt).toISOString()}\nSupport ends: ${new Date(q.supportEndsAt).toISOString()}`,
    });
  return result.map((s) => ({
    title: cleanText(s.title),
    text: cleanText(String(s.text || '')),
  }));
}
async function exportPdf(q) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 54,
    bufferPages: true,
    info: {
      Title: q.title,
      Author: 'Project provider',
      Subject: 'Project quotation and agreement',
    },
  });
  const chunks = [],
    done = new Promise((resolve, reject) => {
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  doc.registerFont(
    'Body',
    path.join(__dirname, '../assets/fonts/NotoSans-Regular.ttf'),
  );
  doc.registerFont(
    'Devanagari',
    path.join(__dirname, '../assets/fonts/NotoSansDevanagari-Regular.ttf'),
  );
  const font = (text) => (/[\u0900-\u097f]/.test(text) ? 'Devanagari' : 'Body');
  doc
    .font(font(q.title))
    .fillColor('#101820')
    .fontSize(23)
    .text(cleanText(q.title));
  doc.moveDown(0.6);
  for (const section of sections(q)) {
    const paragraphs = section.text.split(/\n\n+/);
    const width = doc.page.width - 108;
    const measure = (text) =>
      doc
        .font(font(text))
        .fontSize(11)
        .heightOfString(text, { width, lineGap: 3 });
    if (section.title) {
      const needed = 48 + Math.min(measure(paragraphs[0]), 400);
      if (doc.y + needed > doc.page.height - 54) doc.addPage();
      doc
        .moveDown(0.65)
        .font(font(section.title))
        .fontSize(14)
        .fillColor('#172b42')
        .text(section.title);
      doc.moveDown(0.35);
    }
    for (const paragraph of paragraphs) {
      const height = measure(paragraph);
      if (
        height < doc.page.height - 108 &&
        doc.y + height > doc.page.height - 54
      )
        doc.addPage();
      doc
        .font(font(paragraph))
        .fontSize(11)
        .fillColor('#20252c')
        .text(paragraph, { lineGap: 3 });
      doc.moveDown(0.6);
    }
  }
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Body')
      .fontSize(8)
      .fillColor('#66717e')
      .text(
        `Revision ${q.revision} | Page ${index + 1} of ${range.count}`,
        54,
        doc.page.height - 35,
        { lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
async function exportDocx(q) {
  const children = [
    new Paragraph({
      text: cleanText(q.title),
      heading: HeadingLevel.TITLE,
      spacing: { after: 220 },
    }),
  ];
  for (const section of sections(q)) {
    if (section.title)
      children.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          keepNext: true,
          spacing: { before: 240, after: 120 },
        }),
      );
    for (const paragraph of section.text.split(/\n\n+/))
      children.push(
        new Paragraph({
          children: paragraph
            .split('\n')
            .map(
              (line, index) =>
                new TextRun({ text: line, break: index ? 1 : 0 }),
            ),
          keepLines: true,
          spacing: { after: 130, line: 280 },
        }),
      );
  }
  return Packer.toBuffer(
    new Document({
      creator: 'Project provider',
      title: q.title,
      description: 'Project quotation and agreement',
      styles: {
        default: { document: { run: { font: 'Calibri', size: 22 } } },
        paragraphStyles: [
          {
            id: 'Title',
            name: 'Title',
            basedOn: 'Normal',
            run: { color: '000000', size: 44, bold: true },
          },
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { color: '172B42', size: 28, bold: true },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `Revision ${q.revision} | Page `,
                      size: 18,
                    }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    }),
  );
}
async function exportQuotation(q, format) {
  if (!['pdf', 'docx'].includes(format))
    throw httpError(400, 'Choose PDF or DOCX.');
  if (q.draftReady === false)
    throw httpError(409, 'Complete the quotation before exporting it.');
  return {
    buffer: format === 'pdf' ? await exportPdf(q) : await exportDocx(q),
    mime:
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    name: `quotation-revision-${q.revision}.${format}`,
  };
}
module.exports = { exportQuotation, sections };
