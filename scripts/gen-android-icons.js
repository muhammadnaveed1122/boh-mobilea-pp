/* Generate Android adaptive-icon assets from the RHK brand masters.
 * Theme: Light (navy logo on cream). Logo is shrunk into the adaptive safe zone
 * so launcher masks (circle / rounded-square) never clip it.
 * Run from the repo root: node scripts/gen-android-icons.js
 *
 * Masters live in assets/icons/source/ :
 *   logo.png           navy RHK logo, transparent, tightly cropped
 *   logo-on-cream.png  composed navy-on-cream square (Play Store)
 */
const path = require('node:path');
const fs = require('node:fs');
const Jimp = require('jimp-compact');

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'assets', 'icons');
const SRC = path.join(DIR, 'source');

const CREAM = 0xf7f7efff; // #F7F7EF
const CANVAS = 1024;
const FG_WIDTH = 0.52; // logo width fraction inside the adaptive safe zone
const ICON_WIDTH = 0.66; // logo width for the maskless splash / universal icon

const out = (n) => path.join(DIR, n);

// Place the (transparent, tightly-cropped) logo, scaled to `widthFrac`, centered
// on a transparent CANVAS square.
async function placeLogo(widthFrac) {
  const logo = await Jimp.read(path.join(SRC, 'logo.png'));
  const w = Math.round(CANVAS * widthFrac);
  const h = Math.round((logo.bitmap.height / logo.bitmap.width) * w);
  logo.resize(w, h);
  const canvas = new Jimp(CANVAS, CANVAS, 0x00000000);
  canvas.composite(logo, Math.round((CANVAS - w) / 2), Math.round((CANVAS - h) / 2));
  return canvas;
}

(async () => {
  // Foreground: navy logo, transparent, padded into the safe zone
  const fg = await placeLogo(FG_WIDTH);
  await fg.writeAsync(out('adaptive-foreground.png'));

  // Monochrome: same shape recolored flat white (OS tints it for themed icons)
  const mono = await placeLogo(FG_WIDTH);
  mono.scan(0, 0, mono.bitmap.width, mono.bitmap.height, (x, y, idx) => {
    if (mono.bitmap.data[idx + 3] > 0) {
      mono.bitmap.data[idx] = 255;
      mono.bitmap.data[idx + 1] = 255;
      mono.bitmap.data[idx + 2] = 255;
    }
  });
  await mono.writeAsync(out('adaptive-monochrome.png'));

  // Background: solid cream
  await new Jimp(CANVAS, CANVAS, CREAM).writeAsync(out('adaptive-background.png'));

  // Play Store listing icon: composed navy-on-cream square @ 512
  const store = await Jimp.read(path.join(SRC, 'logo-on-cream.png'));
  store.resize(512, 512);
  await store.writeAsync(out('playstore-512.png'));

  // Universal app icon + splash (no mask): roomier navy logo on transparent
  const icon = await placeLogo(ICON_WIDTH);
  await icon.writeAsync(out('icon.png'));

  console.log(
    'Wrote:',
    fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith('.png'))
      .join(', '),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
