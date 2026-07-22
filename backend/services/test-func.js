const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

// Test1: basic function call
const code1 = `export default async function({ page }) { return 'hello'; };`;
const payload1 = JSON.stringify({ code: code1 });

function test(endpoint, payload, label) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`${label}: HTTP ${res.statusCode}, ${Date.now()-t0}ms, response: ${d.slice(0, 100)}`);
        resolve();
      });
    });
    req.on('error', e => { console.log(`${label}: error - ${e.message}`); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Test different endpoints
  await test('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=10000', payload1, 'plain /function');
  await test('https://chrome.browserless.io/chromium/function?token=' + API_KEY + '&timeout=10000', payload1, '/chromium/function');
}
main();
