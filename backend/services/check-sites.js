const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const SITES = [
  { id: 'classstream', url: 'https://school.pratyushes.dev/login' },
  { id: 'recalibrate-forum', url: 'https://recalibrating.capskengeri.com/login' }
];

async function checkSite(id, url) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      url,
      gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 }
    });
    const req = https.request('https://chrome.browserless.io/screenshot?token=' + API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        console.log(`${id}: HTTP ${res.statusCode}, size=${buf.length}b`);
        resolve();
      });
    });
    req.on('error', e => { console.log(`${id}: error - ${e.message}`); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  for (const s of SITES) {
    await checkSite(s.id, s.url);
    await new Promise(r => setTimeout(r, 2000));
  }
}
main();
