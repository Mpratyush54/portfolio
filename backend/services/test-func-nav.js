const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

async function run(label, code, timeout = 20000) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ code });
    const t0 = Date.now();
    const req = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=' + timeout, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(label + ': HTTP ' + res.statusCode + ' in ' + (Date.now()-t0) + 'ms ' + d.slice(0, 200));
        resolve();
      });
    });
    req.on('error', e => { console.log(label + ': error ' + e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  await run('navigate only', `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
    return 'loaded ' + page.url();
  };`, 20000);

  await new Promise(r => setTimeout(r, 3000));

  await run('navigate + wait 5s', `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
    await new Promise(r => setTimeout(r, 5000));
    return 'waited 5s, url: ' + page.url();
  };`, 25000);

  await new Promise(r => setTimeout(r, 3000));

  await run('navigate + get title after wait', `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
    await new Promise(r => setTimeout(r, 5000));
    const t = await page.title();
    return 'title: ' + t;
  };`, 25000);
}
main();
