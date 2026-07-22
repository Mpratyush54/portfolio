const https = require('https');
const repos = [
  'Mpratyush54/classstream-frontend',
  'Mpratyush54/classstream-backend',
  'Mpratyush54/Phone-Proctor',
  'Mpratyush54/Battery-AAdhar',
  'Mpratyush54/CAPS-Automation',
  'Mpratyush54/server-automation',
  'Mpratyush54/RTMP-Server',
];
let i = 0;
function next() {
  if (i >= repos.length) return;
  const repo = repos[i++];
  https.get(`https://github.com/${repo}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const m = d.match(/<meta property="og:image" content="([^"]+)"/);
      console.log(repo + ':', m ? m[1] : 'no og image');
      next();
    });
  }).on('error', e => {
    console.log(repo + ':', e.message);
    next();
  });
}
next();
