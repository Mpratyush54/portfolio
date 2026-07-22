const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=15000';

async function run(code) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ code });
    const req = https.request(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('HTTP', res.statusCode, '|', d.slice(0, 500));
        resolve();
      });
    });
    req.on('error', e => { console.log('Error:', e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  await run(`export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
    await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
    await new Promise(r => setTimeout(r, 500));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('button[type="submit"]')
    ]);
    await new Promise(r => setTimeout(r, 2000));
    const storage = await page.evaluate(() => {
      const ls = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        ls[k] = localStorage.getItem(k).substring(0, 50);
      }
      const ss = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        ss[k] = sessionStorage.getItem(k).substring(0, 50);
      }
      return JSON.stringify({ localStorage: ls, sessionStorage: ss, url: location.href, cookies: document.cookie });
    });
    return storage;
  };`);
}
main();
