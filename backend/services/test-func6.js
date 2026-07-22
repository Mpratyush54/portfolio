const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=15000';

const codes = [
  // Test A: just page.url() after click
  `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
    await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
    await new Promise(r => setTimeout(r, 500));
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 3000));
    return 'url: ' + page.url();
  };`,

  // Test B: just cookies after click
  `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
    await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
    await new Promise(r => setTimeout(r, 500));
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 3000));
    const c = await page.cookies();
    return 'cookies: ' + c.length + ' first: ' + (c[0] ? c[0].name : 'none');
  };`,

  // Test C: just evaluate title after click
  `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
    await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
    await new Promise(r => setTimeout(r, 500));
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 3000));
    const t = await page.evaluate(() => document.title);
    return 'title: ' + t;
  };`
];

async function run(i, code) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ code });
    const req = https.request(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`Test ${String.fromCharCode(65+i)}: HTTP ${res.statusCode} | ${d.slice(0, 200)}`);
        resolve();
      });
    });
    req.on('error', e => { console.log(`Test ${String.fromCharCode(65+i)}: error - ${e.message}`); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  for (let i = 0; i < codes.length; i++) {
    await run(i, codes[i]);
  }
}
main();
