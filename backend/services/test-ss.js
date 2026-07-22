const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function ss(label, url) {
  const payload = JSON.stringify({
    url, options: { type: 'jpeg', quality: 85 },
    viewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
    gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 }
  });
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.request('https://chrome.browserless.io/screenshot?token=' + API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = [];
      res.on('data', c => d.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(d);
        console.log(label + ': HTTP ' + res.statusCode + ' in ' + (Date.now()-t0) + 'ms, ' + buf.length + 'b');
        if (res.statusCode === 200) fs.writeFileSync(path.join(OUT_DIR, label + '.jpg'), buf);
        resolve();
      });
    });
    req.on('error', e => { console.log(label + ': error ' + e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  await ss('classstream-login', 'https://school.pratyushes.dev/login');
  await ss('classstream-home', 'https://school.pratyushes.dev/');
  await ss('recalibrate-forum', 'https://recalibrating.capskengeri.com/');
  await ss('example', 'https://example.com');
}
main();
