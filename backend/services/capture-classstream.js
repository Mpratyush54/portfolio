const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=30000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const code = `
export default async function({ page }) {
  const results = [];

  // Login
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
  await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
  await new Promise(r => setTimeout(r, 500));
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 5000));

  // Dashboard (already here after login)
  try {
    let ss = await page.screenshot({ type: 'jpeg', quality: 85 });
    results.push({ name: 'classstream', data: Array.from(ss) });
  } catch(e) { results.push({ name: 'classstream', error: e.message }); }

  // Other pages
  for (const path of ['/classes', '/students', '/messages', '/settings']) {
    try {
      await page.goto('https://school.pratyushes.dev' + path, { waitUntil: 'load', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3000));
      let ss = await page.screenshot({ type: 'jpeg', quality: 85 });
      const parts = path.split('/').filter(Boolean);
      results.push({ name: 'classstream-' + (parts.length ? parts[parts.length-1] : 'home'), data: Array.from(ss) });
    } catch(e) {
      const parts = path.split('/').filter(Boolean);
      results.push({ name: 'classstream-' + (parts.length ? parts[parts.length-1] : 'home'), error: e.message });
    }
  }

  return JSON.stringify(results);
};
`;

console.log('Taking ClassStream screenshots with "load" event...');
const payload = JSON.stringify({ code });
const req = https.request(EP, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const results = JSON.parse(d);
        for (const r of results) {
          if (r.error) console.log('  \u2717 ' + r.name + ': ' + r.error);
          else {
            fs.writeFileSync(path.join(OUT_DIR, r.name + '.jpg'), Buffer.from(r.data));
            console.log('  \u2713 ' + r.name + ' \u2014 ' + r.data.length + ' bytes');
          }
        }
      } catch(e) {
        console.log('Parse error:', e.message);
        console.log('Response:', d.slice(0, 300));
      }
    } else {
      console.log('HTTP', res.statusCode, ':', d.slice(0, 200));
    }
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
