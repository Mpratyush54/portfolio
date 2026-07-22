const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

// Test function endpoint with same URL as screenshot
const code = `export default async function({ page }) {
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));
  return await page.title();
};`;

const payload = JSON.stringify({ code });
console.log('Starting function test with school.pratyushes.dev/login...');
const t0 = Date.now();
const req = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=30000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode, 'in', Date.now()-t0, 'ms');
    console.log('Response:', d);
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
