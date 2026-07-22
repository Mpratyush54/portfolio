const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

const code = `export default async function({ page }) {
  await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'load', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  const info = await page.evaluate(() => {
    return JSON.stringify({
      url: location.href,
      title: document.title,
      forms: Array.from(document.querySelectorAll('form')).map(f => ({
        action: f.action,
        inputs: Array.from(f.querySelectorAll('input')).map(i => ({ type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, cls: i.className })),
        buttons: Array.from(f.querySelectorAll('button')).map(b => ({ type: b.type, text: b.innerText.trim(), cls: b.className }))
      })),
      linksCount: document.querySelectorAll('a').length,
      bodySize: document.body.innerText.length
    });
  });
  return info;
};`;

const payload = JSON.stringify({ code });
const req = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=20000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log(JSON.stringify(JSON.parse(d), null, 2));
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
