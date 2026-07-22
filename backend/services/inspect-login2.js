const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

const code = `
export default async function({ page }) {
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));
  const html = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    if (forms.length > 0) {
      const f = forms[0];
      const inputs = Array.from(f.querySelectorAll('input')).map(i => ({ type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, className: i.className }));
      const buttons = Array.from(f.querySelectorAll('button')).map(b => ({ type: b.type, text: b.innerText, className: b.className }));
      const url = window.location.href;
      return JSON.stringify({ url, action: f.action, inputs, buttons });
    }
    const allInputs = Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, name: i.name, id: i.id, placeholder: i.placeholder }));
    return JSON.stringify({ url: window.location.href, inputs: allInputs, formsCount: document.querySelectorAll('form').length });
  });
  return html;
};
`;

const payload = JSON.stringify({ code });

const req = https.request('https://chrome.browserless.io/chromium/function?token=' + API_KEY + '&timeout=30000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', d.slice(0, 2000));
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
