// Generates media/icon.png (128x128) for the VS Code Marketplace from scratch,
// with no native image dependencies. Renders at 4x and downsamples for AA.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 128;
const SS = 4;
const W = SIZE * SS;

// Colors
const BG = [24, 121, 139]; // teal
const FG = [240, 249, 251]; // near-white glyph

// Geometry in 128-space (scaled by SS at use).
const cx = 56,
  cy = 54,
  rOut = 40,
  rIn = 31;
const handle = { x1: 82, y1: 80, x2: 112, y2: 110, w: 13 };
const bars = [44, 54, 64].map((y) => ({ y, x0: 34, x1: 80, t: 6 }));

function insideRoundRect(x, y, w, h, r) {
  const dx = Math.max(0, Math.max(0 + r - x, x - (w - r)));
  const dy = Math.max(0, Math.max(0 + r - y, y - (h - r)));
  if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r;
  if (x > w - r && y < r) return (x - (w - r)) ** 2 + (y - r) ** 2 <= r * r;
  if (x < r && y > h - r) return (x - r) ** 2 + (y - (h - r)) ** 2 <= r * r;
  if (x > w - r && y > h - r) return (x - (w - r)) ** 2 + (y - (h - r)) ** 2 <= r * r;
  return dx === 0 || dy === 0 ? true : false;
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx,
    qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function glyphAt(x, y) {
  // x,y in 128-space.
  const dr = Math.hypot(x - cx, y - cy);
  if (dr >= rIn && dr <= rOut) return true; // ring
  if (distToSeg(x, y, handle.x1, handle.y1, handle.x2, handle.y2) <= handle.w / 2) return true; // handle
  if (dr < rIn - 2) {
    for (const b of bars) {
      if (x >= b.x0 && x <= b.x1 && Math.abs(y - b.y) <= b.t / 2) return true; // text lines
    }
  }
  return false;
}

// Render supersampled.
const big = new Uint8Array(W * W * 4);
for (let py = 0; py < W; py++) {
  for (let px = 0; px < W; px++) {
    const x = px / SS;
    const y = py / SS;
    const i = (py * W + px) * 4;
    if (!insideRoundRect(x, y, SIZE, SIZE, 24)) {
      big[i + 3] = 0;
      continue;
    }
    const fg = glyphAt(x, y);
    const c = fg ? FG : BG;
    big[i] = c[0];
    big[i + 1] = c[1];
    big[i + 2] = c[2];
    big[i + 3] = 255;
  }
}

// Downsample SSxSS average -> 128.
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        r += big[i];
        g += big[i + 1];
        b += big[i + 2];
        a += big[i + 3];
      }
    }
    const n = SS * SS;
    const o = (y * SIZE + x) * 4;
    out[o] = Math.round(r / n);
    out[o + 1] = Math.round(g / n);
    out[o + 2] = Math.round(b / n);
    out[o + 3] = Math.round(a / n);
  }
}

// Encode PNG.
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  out.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const dest = path.join(__dirname, '..', 'media', 'icon.png');
fs.writeFileSync(dest, png);
console.log(`wrote ${dest} (${png.length} bytes)`);
