const https = require('https');

const LANG_COLORS = {
  'TypeScript': '#3178C6', 'JavaScript': '#F7DF1E', 'HTML': '#E34C26',
  'CSS': '#563D7C', 'Python': '#3776AB', 'Shell': '#89e051',
  'Dart': '#0175c2', 'Go': '#00ADD8', 'Dockerfile': '#384d54',
  'Makefile': '#427819', 'C': '#555555', 'Rust': '#dea584',
  'Kotlin': '#A97BFF', 'PowerShell': '#012456', 'Roff': '#ecdebe',
  'TSX': '#3178C6', 'Jupyter Notebook': '#DA5B0B'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'Portfolio-Backend/1.0' } };
    if (process.env.GITHUB_TOKEN) opts.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    https.get(url, opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }
        else { reject(new Error(`HTTP ${res.statusCode}`)); }
      });
    }).on('error', reject);
  });
}

function computeStats(allStats) {
  const t = Object.values(allStats).reduce((a, b) => a + b, 0);
  if (!t) return [];
  return Object.entries(allStats).map(([n, b]) => ({ name: n, percent: Math.round((b / t) * 100), color: LANG_COLORS[n] || '#94a3b8' })).filter(l => l.percent > 0).sort((a, b) => b.percent - a.percent).slice(0, 8);
}

async function syncMetaOnly() {
  const results = [];

  const ghRepos = [
    'Mpratyush54/classstream-frontend', 'Mpratyush54/classstream-backend', 'Mpratyush54/Phone-Proctor',
    'Mpratyush54/CAPS-Automation', 'Mpratyush54/Battery-AAdhar', 'Mpratyush54/recommendation-_system',
    'Mpratyush54/exam-protector-mobile',
    'Mpratyush54/RTMP-Server', 'Mpratyush54/Ambue-pharmacutical-scanner-android-web-backend', 'Mpratyush54/Caps',
    'dauntless-arcane/Forum', 'dauntless-arcane/Competency-Mapping'
  ];

  for (const full of ghRepos) {
    try {
      const [lang, repo] = await Promise.all([
        fetchJson(`https://api.github.com/repos/${full}/languages`).catch(() => ({})),
        fetchJson(`https://api.github.com/repos/${full}`).catch(() => null)
      ]);
      if (!repo) continue;
      const created = new Date(repo.created_at);
      const pushed = repo.pushed_at ? new Date(repo.pushed_at) : null;
      const owner = full.split('/')[0];
      const name = full.split('/')[1];
      results.push({
        sourceUrl: `https://github.com/${full}`,
        languageStats: computeStats(lang),
        status: { phase: repo.archived ? 'Archived' : 'Development', since: repo.created_at.slice(0, 7), ciStatus: 'Not Configured' },
        timeline: {
          start: created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          end: pushed && (Date.now() - pushed.getTime() < 90 * 86400000) ? 'Active' : pushed ? pushed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
          history: [{ phase: 'Repository Created', date: created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), completed: true }]
        }
      });
    } catch (e) {
      console.error(`[Sync] Failed ${full}:`, e.message);
    }
  }

  // GitLab
  for (const id of ['techtank.capskengeri-group%2Fcaps-kengeri', 'campus-navigator%2FCAPS-Automation-backend', 'techtank.capskengeri%2FCAPS-Automation']) {
    try {
      const gl = await fetchJson(`https://gitlab.com/api/v4/projects/${id}`);
      let langData = {};
      try { langData = await fetchJson(`https://gitlab.com/api/v4/projects/${id}/languages`); } catch (e) {}
      const langBytes = {};
      for (const [lang, pct] of Object.entries(langData)) langBytes[lang] = Math.round(pct * 1000);
      const created = gl.created_at ? new Date(gl.created_at) : new Date();
      results.push({
        sourceUrl: gl.web_url || '',
        languageStats: computeStats(langBytes),
        status: { phase: 'Development', since: (gl.created_at || '').slice(0, 7), ciStatus: 'Not Configured' },
        timeline: { start: created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), end: 'Active', history: [{ phase: 'Repository Created', date: created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), completed: true }] }
      });
    } catch (e) {
      console.error(`[Sync] Failed GitLab ${id}:`, e.message);
    }
  }

  return results;
}

module.exports = { syncMetaOnly };
