const path = require("path");
const sharp = require("sharp");

const wideSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f4f4f5"/>
      <stop offset="100%" stop-color="#e4e4e7"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="80" y="48" width="1120" height="86" rx="22" fill="#ffffff" stroke="#d4d4d8"/>
  <rect x="120" y="76" width="132" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="266" y="76" width="46" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="326" y="76" width="46" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="386" y="76" width="46" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="460" y="76" width="420" height="30" rx="15" fill="#fafafa" stroke="#e4e4e7"/>
  <rect x="96" y="168" width="1088" height="504" rx="18" fill="#ffffff" stroke="#e4e4e7"/>
  <rect x="146" y="220" width="988" height="390" rx="12" fill="#ffffff" stroke="#e4e4e7"/>
  <g transform="translate(400,250)">
    <path d="M140 30 L300 190 L160 330 L0 170 Z" fill="#18181b" stroke="#09090b" stroke-width="8"/>
    <path d="M0 170 L-45 215 L-24 294 L64 312 L160 330 Z" fill="#fbbf24" stroke="#a16207" stroke-width="4"/>
    <path d="M-45 215 L-64 320 L50 342 L64 312 Z" fill="#dc2626" stroke="#991b1b" stroke-width="4"/>
  </g>
  <text x="640" y="642" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#52525b">
    MyBoard — совместная работа на доске в реальном времени
  </text>
</svg>`;

const tallSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5f5f5"/>
      <stop offset="100%" stop-color="#e4e4e7"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#bg2)"/>
  <rect x="40" y="38" width="640" height="78" rx="20" fill="#ffffff" stroke="#d4d4d8"/>
  <rect x="70" y="62" width="128" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="208" y="62" width="44" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="262" y="62" width="44" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="316" y="62" width="44" height="30" rx="15" fill="#f4f4f5"/>
  <rect x="50" y="146" width="620" height="1088" rx="16" fill="#ffffff" stroke="#e4e4e7"/>
  <rect x="84" y="188" width="552" height="1008" rx="10" fill="#ffffff" stroke="#e4e4e7"/>
  <g transform="translate(210,420)">
    <path d="M100 20 L220 140 L120 240 L0 120 Z" fill="#18181b" stroke="#09090b" stroke-width="7"/>
    <path d="M0 120 L-34 154 L-18 216 L48 232 L120 240 Z" fill="#fbbf24" stroke="#a16207" stroke-width="4"/>
    <path d="M-34 154 L-50 238 L36 254 L48 232 Z" fill="#dc2626" stroke="#991b1b" stroke-width="4"/>
  </g>
  <text x="360" y="1128" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#52525b">
    MyBoard — realtime canvas
  </text>
</svg>`;

async function run() {
  const out = path.join(__dirname, "..", "public");
  await sharp(Buffer.from(wideSvg)).png().toFile(path.join(out, "screenshot1.png"));
  await sharp(Buffer.from(tallSvg)).png().toFile(path.join(out, "screenshot2.png"));
  console.log("Generated screenshot1.png and screenshot2.png");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
