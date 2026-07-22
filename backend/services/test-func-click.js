const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

async function run(label, code) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ code });
    const t0 = Date.now();
    const req = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=30000', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(label + ': HTTP ' + res.statusCode + ' in ' + (Date.now()-t0) + 'ms');
        if (d.length < 500) console.log('  ' + d);
        else console.log('  ' + d.slice(0, 200) + '... (' + d.length + ' chars)');
        resolve();
      });
    });
    req.on('error', e => { console.log(label + ': error ' + e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Step 1: Navigate + type - does typing work?
  await run('type only', `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('input[name="username"]', 'hellothgfbv', { delay: 10 });
    await page.type('input[name="password"]', 'Pratyush@123', { delay: 10 });
    await new Promise(r => setTimeout(r, 2000));
    return 'typed, url: ' + page.url();
  };`);

  await new Promise(r => setTimeout(r, 2000));

  // Step 2: Navigate + type + click - does click work?
  await run('type + click', `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('input[name="username"]', 'hellothgfbv', { delay: 10 });
    await page.type('input[name="password"]', 'Pratyush@123', { delay: 10 });
    await new Promise(r => setTimeout(r, 500));
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 3000));
    return 'clicked, url: ' + page.url();
  };`);
}
main();
