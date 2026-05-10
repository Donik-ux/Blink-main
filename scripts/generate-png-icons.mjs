// Генерирует PNG-иконки для PWA из client/public/icon.svg.
// Запуск:
//   npm i -D sharp
//   node scripts/generate-png-icons.mjs
//
// На выходе создаст:
//   client/public/icon-192.png
//   client/public/icon-512.png
//   client/public/icon-180.png  (apple-touch-icon)
//   client/public/icon-maskable-512.png
// Также обновит manifest.webmanifest, добавив PNG-варианты.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try { sharp = (await import('sharp')).default; }
catch {
  console.error('✗ Установи зависимость:  npm i -D sharp');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pubDir = resolve(root, 'client/public');
const svgPath = resolve(pubDir, 'icon.svg');

if (!existsSync(svgPath)) {
  console.error('✗ Не найден', svgPath);
  process.exit(1);
}
const svg = readFileSync(svgPath);

const sizes = [
  { name: 'icon-192.png', size: 192, padding: 0 },
  { name: 'icon-512.png', size: 512, padding: 0 },
  { name: 'icon-180.png', size: 180, padding: 0 },
  // maskable: внутри 80% safe zone (10% padding по краям)
  { name: 'icon-maskable-512.png', size: 512, padding: 51 },
];

for (const { name, size, padding } of sizes) {
  const inner = size - padding * 2;
  const buf = await sharp(svg)
    .resize(inner, inner)
    .extend({
      top: padding, bottom: padding, left: padding, right: padding,
      background: { r: 10, g: 10, b: 15, alpha: 1 },
    })
    .png()
    .toBuffer();
  const out = resolve(pubDir, name);
  writeFileSync(out, buf);
  console.log('✓', name);
}

// Обновляем manifest
const manifestPath = resolve(pubDir, 'manifest.webmanifest');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.icons = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ manifest.webmanifest обновлён');
