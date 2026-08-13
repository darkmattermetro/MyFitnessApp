// Genera todos los íconos de la app a partir de un SVG logo.
// Uso: node scripts/render-logo.js
// Fuente: assets/logo2.svg o, si falta, openfit.svg (raíz).

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = fs.existsSync(path.join(ROOT, 'assets', 'logo2.svg'))
  ? path.join(ROOT, 'assets', 'logo2.svg')
  : path.join(ROOT, 'openfit.svg');
const OUT = path.join(ROOT, 'assets');
const LOGO_GREEN = { r: 26, g: 192, b: 143, alpha: 1 };

function write(name, buffer) {
  fs.writeFileSync(path.join(OUT, name), buffer);
  console.log(`OK ${name} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function rounded(input, size) {
  const radius = Math.round(size * 0.22);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`,
  );
  return sharp(input)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function monochrome(size) {
  const { data, info } = await sharp(SRC)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const esVerde = g > 120 && g > r * 1.15 && g > b * 1.15;
    if (a === 0 || esVerde) {
      out[i + 3] = 0; // transparente
    } else {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

(async () => {
  console.log(`Fuente: ${path.relative(ROOT, SRC)}`);
  const base1024 = await sharp(SRC).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();

  write('icon.png', base1024);
  write('splash-icon.png', base1024);
  write('favicon.png', await rounded(base1024, 64));
  write(
    'android-icon-foreground.png',
    await sharp(SRC).resize(432, 432, { fit: 'cover' }).png().toBuffer(),
  );
  write(
    'android-icon-background.png',
    await sharp({ create: { width: 432, height: 432, channels: 4, background: LOGO_GREEN } })
      .png()
      .toBuffer(),
  );
  write('android-icon-monochrome.png', await monochrome(432));
  console.log('Listo.');
})();
