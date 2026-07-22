const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const API_URL = 'https://chrome.browserless.io/screenshot?token=' + API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'screenshots');

const sites = [
  { id: 'classstream', url: 'https://classstream.dev/' },
  { id: 'competency-mapping', url: 'https://competency-mapping.vercel.app' },
  { id: 'caps-kengeri', url: 'https://capskengeri.com/' },
  { id: 'caps-automation', url: 'https://worklog.capskengeri.com/' },
  { id: 'recalibrate-forum', url: 'https://recalibrating.capskengeri.com/' }
];

function takeScreenshot(id, url) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      url,
      options: { type: 'jpeg', quality: 85, fullPage: false },
      viewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 }
    });

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
          reject(new Error(`${id}: HTTP ${res.statusCode} - ${buf.toString()}`));
          return;
        }
        const filepath = path.join(OUT_DIR, `${id}.jpg`);
        fs.writeFileSync(filepath, buf);
        console.log(`✓ ${id} — ${buf.length} bytes`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  for (const site of sites) {
    try {
      await takeScreenshot(site.id, site.url);
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`✗ ${site.id}: ${e.message}`);
    }
  }

  console.log('\nDone. Files in:', OUT_DIR);
}

main().catch(console.error);
