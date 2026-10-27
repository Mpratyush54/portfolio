const path = require('path');
const PDFDocument = require('pdfkit');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} = require('docx');
const { cleanText } = require('./quotationText');
const { httpError } = require('./bookingValidation');
const money = (value) =>
  `INR ${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
const cumulative = (q, index) =>
  `${q.milestones.slice(0, index + 1).reduce((sum, m) => sum + m.percent, 0)}%`;
const phaseLabel = (m, i) => `${m.label}\n${m.timing === 'before' || (!m.timing && i === 0) ? 'Before phase starts' : 'After delivery approval'}`;
function sections(q) {
  const result = [
    {
      title: 'Quotation summary',
      text: `Prepared for ${q.clientName}\nClient email: ${q.clientEmail}\nRevision: ${q.revision} | Status: ${q.status}\nValid until: ${date(q.validUntil)}\nFinal payable total: ${money(q.totalPaise)}\nThis document sets out the project scope, delivery phases, commercial terms and acceptance record.`,
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
            `${i + 1}. ${m.label}: ${m.percent}% - ${money(m.amountPaise)} | ${m.timing === 'before' || (!m.timing && i === 0) ? 'Before phase starts' : 'After delivery approval'}${m.paidAt ? ' | Captured ' + new Date(m.paidAt).toISOString() : ''}`,
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
          '\n\nThe listed SRS files form part of this quotation revision. Original files are available separately in the private portal.'
        : 'No SRS attachments are included in this revision.',
    },
  ];
  // Keep custom paragraphs within the original clause; render only saved text.
  const terms = cleanText(q.terms).replace(/\r\n?/g, '\n');
  const matches = [
    ...terms.matchAll(/^(\d+\. [^\n]+|Project-specific additional terms)\n/gm),
  ];
  const preamble = terms.slice(0, matches[0]?.index ?? terms.length).trim();
  if (preamble)
    result.push({ title: 'Agreement terms', text: preamble, agreement: true });
  matches.forEach((m, i) =>
    result.push({
      title: m[1],
      text: terms
        .slice(m.index + m[0].length, matches[i + 1]?.index ?? terms.length)
        .trim(),
      agreement: true,
    }),
  );
  if (q.acceptance?.at)
    result.push({
      title: 'Recorded acceptance',
      text: `Accepted by: ${q.acceptance.name}\nInvited email: ${q.acceptance.email}\nAccepted at: ${new Date(q.acceptance.at).toISOString()}\nAccepted agreement SHA-256: ${q.acceptance.digest}\nThis is the recorded portal acceptance, not a certified digital signature.`,
    });
  else
    result.push({
      title: 'Acceptance status',
      text: 'This revision has not been accepted. A preview or downloaded copy is not a record of client agreement. Review and accept the exact revision through the private portal.',
    });
  if (q.deployedAt)
    result.push({
      title: 'Support window',
      text: `Production deployment: ${new Date(q.deployedAt).toISOString()}\nSupport ends: ${new Date(q.supportEndsAt).toISOString()}`,
    });
  return result.map((s) => ({
    ...s,
    title: cleanText(s.title),
    text: cleanText(String(s.text || '')),
  }));
}
async function exportPdf(q) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 66, bottom: 60, left: 52, right: 52 },
    bufferPages: true,
    info: {
      Title: cleanText(q.title),
      Author: 'Project provider',
      Subject: 'Project proposal and service agreement',
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
  const left = 52,
    width = doc.page.width - 104;
  const font = (t, bold = false) =>
    /[\u0900-\u097f]/.test(t) ? 'Devanagari' : bold ? 'Helvetica-Bold' : 'Body';
  const measure = (t, size = 10, w = width, bold = false) =>
    doc
      .font(font(t, bold))
      .fontSize(size)
      .heightOfString(t, { width: w, lineGap: 3 });
  const room = (h) => {
    if (doc.y + h > doc.page.height - 60) doc.addPage();
  };
  const text = (
    value,
    { size = 10, color = '#354356', bold = false, gap = 9 } = {},
  ) => {
    const t = cleanText(String(value));
    doc
      .font(font(t, bold))
      .fontSize(size)
      .fillColor(color)
      .text(t, left, doc.y, { width, lineGap: 3 });
    doc.y += gap;
  };
  const heading = (title, first = '') => {
    room(
      measure(title, 13, width, true) +
        (measure(first) < 240 ? measure(first) : 70) +
        26,
    );
    doc.y += 14;
    text(title, { size: 13, bold: true, color: '#182B40', gap: 9 });
  };
  const paragraphs = (value) => {
    for (const p of value.split(/\n\n+/)) {
      const h = measure(p);
      if (h < 240) room(h + 9);
      text(p);
    }
  };
  text('PROJECT PROPOSAL AND SERVICE AGREEMENT', {
    size: 9,
    color: '#617183',
    gap: 14,
  });
  text(q.title, { size: 25, bold: true, color: '#182B40', gap: 13 });
  text(
    'Project scope, commercial terms and the complete agreement for client review.',
    { color: '#617183', gap: 17 },
  );
  doc
    .strokeColor('#DCE2E8')
    .lineWidth(0.6)
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .stroke();
  doc.y += 15;
  text(
    `Revision ${q.revision} | Status: ${q.status} | Accept by ${date(q.validUntil)}`,
    { size: 9, gap: 12 },
  );
  text(`Total project fee: ${money(q.totalPaise)}`, {
    size: 17,
    bold: true,
    color: '#182B40',
    gap: 19,
  });
  text('Prepared for', { size: 9, color: '#617183', gap: 4 });
  text(`${q.clientName}\n${q.clientEmail}`, { gap: 10 });
  let general = false;
  for (const section of sections(q).slice(1)) {
    if (section.agreement && !general) {
      doc.addPage();
      text('General terms and conditions', {
        size: 21,
        bold: true,
        color: '#182B40',
        gap: 12,
      });
      text(
        'Read these clauses together with the project scope, commercial schedule and listed requirements documents.',
        { color: '#617183', gap: 10 },
      );
      general = true;
    }
    if (section.title === 'Milestone payments') {
      room(320);
      heading(
        'Milestone payment schedule',
        'The project fee is split into four instalments.',
      );
      const cols = [width * 0.29, width * 0.12, width * 0.23, width * 0.36];
      const row = (values, header = false) => {
        const h =
          Math.max(
            ...values.map((v, i) =>
              measure(v, header ? 8 : 9, cols[i] - 16, header),
            ),
          ) + 20;
        room(h);
        const y = doc.y;
        doc.rect(left, y, width, h).fill(header ? '#182B40' : '#F3F6F8');
        let x = left;
        values.forEach((v, i) => {
          doc
            .font(font(v, header))
            .fontSize(header ? 8 : 9)
            .fillColor(header ? '#FFFFFF' : '#354356')
            .text(v, x + 8, y + 10, { width: cols[i] - 16, lineGap: 3 });
          x += cols[i];
        });
        doc.y = y + h + 2;
      };
      row(['MILESTONE', 'SHARE', 'AMOUNT', 'CUMULATIVE PAID'], true);
      q.milestones.forEach((m, i) =>
        row([phaseLabel(m, i), `${m.percent}%`, money(m.amountPaise), cumulative(q, i)]),
      );
      doc.y += 10;
      for (const m of q.milestones.filter((m) => m.paidAt))
        text(`${m.label}: captured ${new Date(m.paidAt).toISOString()}`, {
          size: 9,
        });
    } else {
      heading(section.title, section.text.split(/\n\n+/)[0]);
      paragraphs(section.text);
    }
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Body')
      .fontSize(8)
      .fillColor('#617183')
      .text('PRIVATE PROJECT AGREEMENT', left, 30, { lineBreak: false });
    doc.text(`Revision ${q.revision}`, left + width - 100, 30, {
      width: 100,
      align: 'right',
      lineBreak: false,
    });
    doc
      .strokeColor('#DCE2E8')
      .lineWidth(0.5)
      .moveTo(left, doc.page.height - 43)
      .lineTo(left + width, doc.page.height - 43)
      .stroke();
    doc
      .font('Body')
      .fontSize(8)
      .fillColor('#617183')
      .text(
        `Revision ${q.revision} | Page ${i + 1} of ${range.count}`,
        left,
        doc.page.height - 32,
        { width, lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
async function exportDocx(q) {
  const para = (value, options = {}) =>
    new Paragraph({
      children: String(value)
        .split('\n')
        .map(
          (line, i) => new TextRun({ text: cleanText(line), break: i ? 1 : 0 }),
        ),
      spacing: { after: 140, line: 290 },
      widowControl: true,
      ...options,
    });
  const title = (value, options = {}) =>
    new Paragraph({
      text: cleanText(value),
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      spacing: { before: 260, after: 140 },
      ...options,
    });
  const children = [
    para('PROJECT PROPOSAL AND SERVICE AGREEMENT', { style: 'Subtitle' }),
    new Paragraph({
      text: cleanText(q.title),
      heading: HeadingLevel.TITLE,
      spacing: { after: 220 },
    }),
    para(
      'Project scope, delivery milestones, commercial terms and the complete agreement for client review.',
    ),
    para(
      `Revision ${q.revision} | Status: ${q.status} | Accept by ${date(q.validUntil)}`,
    ),
    para(`Total project fee: ${money(q.totalPaise)}`, {
      heading: HeadingLevel.HEADING_2,
    }),
    para(`Prepared for ${q.clientName}\n${q.clientEmail}`),
  ];
  let general = false;
  for (const section of sections(q).slice(1)) {
    if (section.agreement && !general) {
      children.push(
        title('General terms and conditions', { pageBreakBefore: true }),
      );
      children.push(
        para(
          'Read these clauses together with the project scope, commercial schedule and listed requirements documents.',
        ),
      );
      general = true;
    }
    children.push(
      title(
        section.title,
        section.agreement ? { heading: HeadingLevel.HEADING_2 } : {},
      ),
    );
    if (section.title === 'Milestone payments') {
      const data = [
          ['Milestone', 'Share', 'Amount', 'Cumulative paid'],
          ...q.milestones.map((m, i) => [
            phaseLabel(m, i),
            `${m.percent}%`,
            money(m.amountPaise),
            cumulative(q, i),
          ]),
        ],
        widths = [2500, 900, 2000, 4200];
      children.push(
        new Table({
          width: { size: 9600, type: WidthType.DXA },
          columnWidths: widths,
          rows: data.map(
            (r, ri) =>
              new TableRow({
                tableHeader: ri === 0,
                cantSplit: true,
                children: r.map(
                  (v, ci) =>
                    new TableCell({
                      width: { size: widths[ci], type: WidthType.DXA },
                      shading: {
                        fill:
                          ri === 0 ? '182B40' : ri % 2 ? 'F3F6F8' : 'FFFFFF',
                      },
                      margins: { top: 120, bottom: 120, left: 140, right: 140 },
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                      },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: cleanText(v),
                              size: 19,
                              bold: ri === 0,
                              color: ri === 0 ? 'FFFFFF' : '253243',
                            }),
                          ],
                          spacing: { after: 0, line: 260 },
                        }),
                      ],
                    }),
                ),
              }),
          ),
        }),
      );
      children.push(para(''));
      for (const m of q.milestones.filter((m) => m.paidAt))
        children.push(
          para(`${m.label}: captured ${new Date(m.paidAt).toISOString()}`),
        );
    } else for (const p of section.text.split(/\n\n+/)) children.push(para(p));
  }
  return Packer.toBuffer(
    new Document({
      creator: 'Project provider',
      title: cleanText(q.title),
      description: 'Project proposal and service agreement',
      styles: {
        default: {
          document: { run: { font: 'Calibri', size: 22, color: '253243' } },
        },
        paragraphStyles: [
          {
            id: 'Title',
            name: 'Title',
            basedOn: 'Normal',
            run: { color: '000000', size: 48, bold: true },
          },
          {
            id: 'Subtitle',
            name: 'Subtitle',
            basedOn: 'Normal',
            run: { color: '000000', size: 18 },
          },
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { color: '000000', size: 28, bold: true },
          },
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { color: '000000', size: 24, bold: true },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1080, bottom: 1080, left: 1320, right: 1320 },
            },
          },
          headers: {
            default: new Header({
              children: [
                para(`PRIVATE PROJECT AGREEMENT | Revision ${q.revision}`, {
                  style: 'Subtitle',
                }),
              ],
            }),
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
                      color: '617183',
                    }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                    new TextRun({ text: ' of ', size: 18 }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                    }),
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
