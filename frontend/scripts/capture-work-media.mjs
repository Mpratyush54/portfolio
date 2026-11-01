import { chromium } from 'playwright';
import { mkdir, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const root = path.resolve(import.meta.dirname, '..');
const imageDir = path.join(root, 'public/images/work');
const videoDir = path.join(root, 'public/videos/work');

const sites = [
  { id: 'platform', url: 'https://platform.pratyushes.dev/' },
  {
    id: 'classstream',
    url: 'https://school.pratyushes.dev/',
    extra: ['https://school.pratyushes.dev/assets/images/students-learning.webp'],
  },
  { id: 'caps-automation', url: 'https://worklog.capskengeri.com/' },
  { id: 'vision-you', url: 'https://path-finder-ten-xi.vercel.app/' },
  { id: 'caps-kengeri', url: 'https://capskengeri.com/' },
];

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`${url} ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

await mkdir(imageDir, { recursive: true });
await mkdir(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const site of sites) {
  for (const [index, extra] of (site.extra || []).entries()) {
    const ext = path.extname(new URL(extra).pathname) || '.png';
    const dest = path.join(imageDir, `${site.id}-asset-${index + 1}${ext}`);
    try {
      await download(extra, dest);
      console.log('downloaded', dest);
    } catch (error) {
      console.log('skip extra', extra, error.message);
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(imageDir, `${site.id}-hero.png`), type: 'png' });
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(imageDir, `${site.id}-page.png`), type: 'png' });
    console.log('captured', site.id);
  } catch (error) {
    console.log('failed', site.id, error.message);
  }
  const video = page.video();
  await page.close();
  await context.close();
  if (video) {
    try {
      await rename(await video.path(), path.join(videoDir, `${site.id}.webm`));
    } catch (error) {
      console.log('skip video', site.id, error.message);
    }
  }
}

await browser.close();
console.log('done');
