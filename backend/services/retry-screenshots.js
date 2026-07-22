const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const API_URL = 'https://chrome.browserless.io/screenshot?token=' + API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'screenshots');

const retries = [
  { id: 'classstream', url: 'https://classstream.dev/', label: 'ClassStream', opts: { gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 } } },
  { id: 'recalibrate-forum', url: 'https://recalibrating.capskengeri.com/', label: 'Recalibrate Forum', opts: { gotoOptions: { waitUntil: 'networkidle0', timeout: 20000 } } }
];

function takeScreenshot(id, url, extra, label) {
  return new Promise((resolve, reject) => {
    const body = {
      url,
      options: { type: 'jpeg', quality: 85, fullPage: false },
      viewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 },
      ...extra
    };
    const payload = JSON.stringify(body);

    const req = https.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          reject(new Error(`${id}: HTTP ${res.statusCode} - ${buf.toString().slice(0, 100)}`));
          return;
        }
        const filepath = path.join(OUT_DIR, `${id}.jpg`);
        fs.writeFileSync(filepath, buf);
        console.log(`✓ ${id} (${label}) — ${buf.length} bytes`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const r of retries) {
    try {
      await takeScreenshot(r.id, r.url, r.opts, r.label);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`✗ ${r.id}: ${e.message}`);
    }
  }
  console.log('\nDone. Check', OUT_DIR);
}

main().catch(console.error);
