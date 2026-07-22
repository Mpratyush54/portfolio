const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

// Testing with run function approach vs inline
async function run(label, code, timeout = 30000) {
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
        const elapsed = Date.now() - t0;
        console.log(label + ': HTTP ' + res.statusCode + ' in ' + elapsed + 'ms');
        if (d.length < 500) console.log('  ' + d);
        else console.log('  ' + d.slice(0, 200) + ' (' + d.length + ' chars)');
        resolve();
      });
    });
    req.on('error', e => { console.log(label + ': error ' + e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Test 1: inline code
  console.log('=== Test 1: inline code ===');
  await run('inline', `export default async function({ page }) {
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
    await new Promise(r => setTimeout(r, 4000));
    const url = page.url();
    const title = await page.title();
    const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
    return JSON.stringify([{ n: 'after-login', u: url, t: title, d: Array.from(ss) }]);
  };`);

  // Test 2: same code as variable
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
    await new Promise(r => setTimeout(r, 4000));
    const url = page.url();
    const title = await page.title();
    const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
    return JSON.stringify([{ n: 'after-login', u: url, t: title, d: Array.from(ss) }]);
  };`;

  await new Promise(r => setTimeout(r, 3000));
  console.log('\n=== Test 2: variable code ===');
  await run('variable', code);
}
main();
