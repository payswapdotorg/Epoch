#!/usr/bin/env node
// W048 — generate the deterministic Tauri icon set (pure Node, no external
// tools): PNGs at every size the bundlers need, a Windows ICO (PNG payloads,
// Vista+ format), and a macOS ICNS (PNG payload chunks ic07/ic08/ic09/ic10).
//
// The mark: the Epoch "E" — a dark slate rounded square, an amber spine and
// three arms (the deterministic geometry; same pixels on every machine, so
// the icon set is byte-stable and committed).
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'src-tauri', 'icons');

// ---------------------------------------------------------------------------
// Pure-Node PNG encoder (RGBA, filter 0, zlib deflate).
// ---------------------------------------------------------------------------

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData) >>> 0, 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// The Epoch mark (deterministic geometry over a normalized 1024 grid).
// ---------------------------------------------------------------------------

const BG = [30, 34, 40, 255]; // dark slate
const SPINE = [240, 178, 64, 255]; // amber
const ARM = [235, 235, 230, 255]; // off-white
const CLEAR = [0, 0, 0, 0];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

/** Render the mark at `size` px (supersampled x4 for clean edges). */
function renderMark(size) {
  const ss = 4;
  const grid = size * ss;
  const rgba = Buffer.alloc(size * size * 4);
  // Normalized geometry (0..1): rounded-square background, E glyph.
  const radius = 0.185;
  const spineX0 = 0.335, spineX1 = 0.455, spineY0 = 0.225, spineY1 = 0.775;
  const armW = 0.34;
  const arm1Y0 = 0.225, arm1Y1 = 0.335;
  const arm2Y0 = 0.455, arm2Y1 = 0.565;
  const arm3Y0 = 0.665, arm3Y1 = 0.775;
  const armsX0 = spineX1 - 0.02, armsX1 = armsX0 + armW;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Supersample coverage of background + glyph sub-pixels.
      let bgHits = 0;
      let spineHits = 0;
      let armHits = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = (x * ss + sx + 0.5) / grid;
          const py = (y * ss + sy + 0.5) / grid;
          // Rounded square coverage.
          const cx = Math.min(Math.max(px, radius), 1 - radius);
          const cy = Math.min(Math.max(py, radius), 1 - radius);
          const dx = px - cx;
          const dy = py - cy;
          const inside = dx * dx + dy * dy <= radius * radius;
          if (!inside) continue;
          bgHits += 1;
          if (px >= spineX0 && px <= spineX1 && py >= spineY0 && py <= spineY1) {
            spineHits += 1;
          } else if (
            px >= armsX0 && px <= armsX1 &&
            ((py >= arm1Y0 && py <= arm1Y1) || (py >= arm2Y0 && py <= arm2Y1) || (py >= arm3Y0 && py <= arm3Y1))
          ) {
            armHits += 1;
          }
        }
      }
      const total = ss * ss;
      const idx = (y * size + x) * 4;
      if (bgHits === 0) {
        rgba[idx] = CLEAR[0]; rgba[idx + 1] = CLEAR[1]; rgba[idx + 2] = CLEAR[2]; rgba[idx + 3] = CLEAR[3];
        continue;
      }
      let color = BG;
      if (armHits > 0 && spineHits === 0) {
        color = mix(BG, ARM, armHits / total);
      } else if (spineHits > 0) {
        color = mix(BG, SPINE, spineHits / total);
        if (armHits > 0) color = mix(color, ARM, (armHits / total) * 0.5);
      }
      // Slight vertical sheen for depth (deterministic).
      color = mix(color, [Math.min(255, color[0] + 10), Math.min(255, color[1] + 10), Math.min(255, color[2] + 10), color[3]], (1 - y / size) * 0.25);
      rgba[idx] = color[0]; rgba[idx + 1] = color[1]; rgba[idx + 2] = color[2]; rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// ICO (PNG payloads) + ICNS (PNG payload chunks).
// ---------------------------------------------------------------------------

function buildIco(pngs) {
  // ICO header: reserved(2)=0, type(2)=1, count(2)=N, then N directory
  // entries (width byte, height byte, colors=0, reserved=0, planes=1,
  // bitcount=32, size(4), offset(4)), then the PNG payloads.
  const entries = [];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const directory = Buffer.alloc(pngs.length * 16);
  pngs.forEach((png, index) => {
    const size = png.size;
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // colors
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(png.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    directory.set(entry, index * 16);
    entries.push(png.data);
    offset += png.data.length;
  });
  return Buffer.concat([header, directory, ...entries]);
}

function buildIcns(chunks) {
  // ICNS: magic 'icns' + total length (BE u32), then per-chunk:
  // 4-char type + BE u32 length (type + length + png data).
  const body = [];
  let total = 8;
  for (const chunk of chunks) {
    const head = Buffer.alloc(8);
    head.write(chunk.type, 0, 'ascii');
    head.writeUInt32BE(8 + chunk.data.length, 4);
    body.push(head, chunk.data);
    total += 8 + chunk.data.length;
  }
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(total, 4);
  return Buffer.concat([header, ...body]);
}

// ---------------------------------------------------------------------------
// Render the full set.
// ---------------------------------------------------------------------------

const sizes = [32, 128, 256, 512, 1024];
const pngs = new Map();
for (const size of sizes) {
  pngs.set(size, encodePng(size, size, renderMark(size)));
}

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, '32x32.png'), pngs.get(32));
writeFileSync(path.join(outDir, '128x128.png'), pngs.get(128));
writeFileSync(path.join(outDir, '128x128@2x.png'), pngs.get(256));
writeFileSync(path.join(outDir, 'icon.png'), pngs.get(512));
writeFileSync(
  path.join(outDir, 'icon.ico'),
  buildIco([
    { size: 16, data: encodePng(16, 16, renderMark(16)) },
    { size: 32, data: pngs.get(32) },
    { size: 128, data: pngs.get(128) },
    { size: 256, data: pngs.get(256) },
  ]),
);
writeFileSync(
  path.join(outDir, 'icon.icns'),
  buildIcns([
    { type: 'ic07', data: pngs.get(128) }, // 128x128
    { type: 'ic08', data: pngs.get(256) }, // 256x256
    { type: 'ic09', data: pngs.get(512) }, // 512x512
    { type: 'ic10', data: pngs.get(1024) }, // 1024x1024 (512@2x)
  ]),
);

console.log(`[generate-icons] wrote the Epoch icon set to ${path.relative(process.cwd(), outDir)}: 32/128/128@2x/512 PNG + icon.ico + icon.icns (deterministic geometry, byte-stable)`);
