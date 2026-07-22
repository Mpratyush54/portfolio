const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

const code = `export default async function({ page }) {
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => {
    document.querySelector('input[name="username"]').value = 'hellothgfbv';
    document.querySelector('input[name="username"]').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('input[name="password"]').value = 'Pratyush@123';
    document.querySelector('input[name="password"]').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => { document.querySelector('button[type="submit"]').click(); });
  await new Promise(r => setTimeout(r, 5000));
  const currentUrl = page.url();
  
  // Try navigating to /classes
  try {
    await page.goto('https://school.pratyushes.dev/classes', { waitUntil: 'load', timeout: 10000 });
  } catch(e) {
    return 'navigate to classes failed: ' + e.message + ', current url: ' + currentUrl + ', after nav url: ' + page.url();
  }
  
  await new Promise(r => setTimeout(r, 3000));
  return 'navigated to classes, url: ' + page.url();
};`;

console.log('Test: login + navigate to /classes...');
const payload = JSON.stringify({ code });
const t0 = Date.now();
const req = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=45000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('HTTP', res.statusCode, 'in', Date.now()-t0, 'ms');
    console.log('Response:', d.slice(0, 300));
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
