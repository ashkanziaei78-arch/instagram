// Renders teaser.html frame-by-frame and muxes with music.wav into an MP4.
// usage: [HTML=v2/teaser.html] node render.mjs out.mp4 music.wav [--stills t1,t2,...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import path from 'node:path';

const [out, music] = process.argv.slice(2);
const stillsArg = process.argv.indexOf('--stills');
const FPS = 30;
const ffmpeg = execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.resolve(process.env.HTML || 'teaser.html') + '?capture');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const DUR = await page.evaluate(() => window.DUR);

if (stillsArg > 0) {
  for (const t of process.argv[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: `${out}/still_${t}.png` });
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', music, '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(DUR * FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.render(t), f / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 150 === 0) console.log(`frame ${f}/${total}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('done', out);
