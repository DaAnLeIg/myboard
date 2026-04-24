/**
 * Генерирует public/icon-192.png и public/icon-512.png из SVG (один раз при изменении дизайна).
 * Запуск: node scripts/generate-pwa-icons.cjs
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const svg512 = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#d4d4d8"/>
  <rect x="72" y="64" width="368" height="384" rx="20" fill="#ffffff" stroke="#a1a1aa" stroke-width="3"/>
  <g transform="translate(0,0)">
    <path d="M268 118 L388 238 L248 378 L128 258 Z" fill="#18181b" stroke="#09090b" stroke-width="6" stroke-linejoin="round"/>
    <path d="M128 258 L88 298 L108 368 L188 388 L248 378 Z" fill="#fbbf24" stroke="#ca8a04" stroke-width="3" stroke-linejoin="round"/>
    <path d="M88 298 L68 392 L172 412 L188 388 Z" fill="#dc2626" stroke="#991b1b" stroke-width="3" stroke-linejoin="round"/>
    <path d="M268 118 L292 94 L412 214 L388 238 Z" fill="#27272a"/>
  </g>
</svg>`;

async function main() {
  const publicDir = path.join(__dirname, "..", "public");
  const buf = Buffer.from(svg512);

  await sharp(buf).resize(512, 512).png().toFile(path.join(publicDir, "icon-512.png"));
  await sharp(buf).resize(192, 192).png().toFile(path.join(publicDir, "icon-192.png"));

  console.log("Wrote public/icon-512.png and public/icon-192.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
