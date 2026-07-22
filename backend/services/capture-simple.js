const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Test 1: Just navigate + screenshot a public page
async function test() {
  for (const [label, url] of Object.entries({
    'classstream-login': 'https://school.pratyushes.dev/login'
  })) {
    console.log(`Trying ${label}...`);
    const t0 = Date.now();
    const payload = JSON.stringify({
      url,
      options: { type: 'jpeg', quality: 85 },
      viewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 }
    });
    await new Promise((resolve) => {
      const req = https.request('https://chrome.browserless.io/screenshot?token=' + API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          console.log(`  HTTP ${res.statusCode}, ${Date.now()-t0}ms, ${buf.length}b`);  
          if (res.statusCode === 200) {
            fs.writeFileSync(path.join(OUT_DIR, label + '.jpg'), buf);
            console.log('  Saved!');
          }
          resolve();
        });
      });
      req.on('error', e => { console.log('  Error:', e.message); resolve(); });
      req.write(payload);
      req.end();
    });
  }
}
test();
